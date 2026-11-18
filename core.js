/* Shared Vimeo, timestamp and CSV helpers. */
(() => {
  'use strict';
  const MAX_TIME = 864000;
  const id = () => globalThis.crypto?.randomUUID?.() || 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  function vimeo(input) {
    let url;
    try { url = new URL(String(input).trim()); } catch { throw Error('Enter a complete Vimeo link, starting with https://vimeo.com/.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(url.hostname)) {
      throw Error('Use an HTTPS link from vimeo.com or player.vimeo.com.');
    }
    const parts = url.pathname.split('/').filter(Boolean);
    let videoId, hash;
    if (url.hostname === 'player.vimeo.com' && parts.length === 2 && parts[0] === 'video') videoId = parts[1];
    else if (url.hostname !== 'player.vimeo.com') {
      if (/^\d+$/.test(parts[0] || '') && parts.length <= 2) { videoId = parts[0]; hash = parts[1]; }
      else if (parts[0] === 'channels' && parts.length === 3) videoId = parts[2];
      else if (parts[0] === 'groups' && parts[2] === 'videos' && parts.length === 4) videoId = parts[3];
      else if (parts[0] === 'showcase' && parts[2] === 'video' && parts.length === 4) videoId = parts[3];
      else if (parts[0] === 'manage' && parts[1] === 'videos' && parts.length === 3) videoId = parts[2];
    }
    hash = url.searchParams.get('h') || hash;
    if (!/^[1-9]\d{0,14}$/.test(videoId || '') || (hash && !/^[a-zA-Z0-9]{6,64}$/.test(hash))) {
      throw Error('This link does not identify a Vimeo video. Copy its video or unlisted sharing link.');
    }
    const canonical = `https://vimeo.com/${videoId}${hash ? '/' + hash : ''}`;
    const embed = new URL(`https://player.vimeo.com/video/${videoId}`);
    if (hash) embed.searchParams.set('h', hash);
    embed.searchParams.set('dnt', '1');
    embed.searchParams.set('title', '0');
    embed.searchParams.set('byline', '0');
    embed.searchParams.set('portrait', '0');
    return { id: videoId, hash: hash || '', url: canonical, embed: embed.href };
  }
  function parseTime(value) {
    const text = String(value).trim();
    if (!text || !/^\d+(?:\.\d+)?$|^\d+:\d{1,2}(?:\.\d+)?$|^\d+:\d{1,2}:\d{1,2}(?:\.\d+)?$/.test(text)) return NaN;
    const parts = text.split(':').map(Number);
    if (parts.length > 1 && parts.at(-1) >= 60) return NaN;
    if (parts.length === 3 && parts[1] >= 60) return NaN;
    const n = parts.reduce((a, b) => a * 60 + b, 0);
    return Number.isFinite(n) && n <= MAX_TIME ? n : NaN;
  }
  function formatTime(value, precise = false) {
    const n = Math.max(0, Number(value) || 0);
    let seconds = Math.floor(n), suffix = '';
    if (precise) {
      const tenths = Math.round(n * 10);
      seconds = Math.floor(tenths / 10);
      if (tenths % 10) suffix = '.' + tenths % 10;
    }
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(Math.floor(seconds / 60)).padStart(2, '0')) + ':' + String(s).padStart(2, '0') + suffix;
  }
  function csvCell(value) {
    let s = String(value ?? '');
    // Check compatibility-normalised text too: some spreadsheets recognise
    // full-width formula prefixes such as ＝, ＋, － and ＠.
    if (/^[\s\uFEFF]*[=+@-]/.test(s.normalize('NFKC')) || /^[\t\r\n]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function cleanDraft(value) {
    if (!value || value.schema !== 2 || !Array.isArray(value.notes) || value.notes.length > 20000) throw Error('Invalid draft');
    const source = value.source ? vimeo(value.source).url : '';
    if (!source && value.notes.length) throw Error('Missing video');
    const used = new Set();
    const notes = value.notes.map(c => {
      if (!c || !Number.isFinite(c.t) || c.t < 0 || c.t > MAX_TIME || typeof c.note !== 'string' || !c.note.trim() || c.note.length > 10000) throw Error('Invalid feedback');
      const noteId = typeof c.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(c.id) && !used.has(c.id) ? c.id : id();
      used.add(noteId);
      return { id: noteId, t: c.t, end: Number.isFinite(c.end) && c.end > c.t && c.end <= MAX_TIME ? c.end : null, note: c.note };
    });
    const editing = notes.some(n => n.id === value.form?.editing) ? value.form.editing : null;
    const form = { time: Number.isFinite(parseTime(value.form?.time)) ? String(value.form.time) : '00:00', text: typeof value.form?.text === 'string' ? value.form.text.slice(0, 10000) : '', editing };
    return { schema: 2, source, notes, form };
  }
  function migrateLegacy(raw) {
    if (!Array.isArray(raw?.projects)) return null;
    const projects = raw.projects.slice().sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    for (const p of projects) {
      if (!Array.isArray(p?.versions)) continue;
      const versions = p.versions.slice().sort((a, b) => (b.number || 0) - (a.number || 0));
      for (const v of versions) {
        if (!Array.isArray(v?.comments)) continue;
        try {
          return cleanDraft({ schema: 2, source: v.source, notes: v.comments.map(c => ({
            id: c.id, t: c.t, end: c.end, note: String(c.note || '') + (Array.isArray(c.replies) ? c.replies.filter(r => r?.note).map(r => '\n\n' + (r.name ? r.name + ': ' : '') + r.note).join('') : '')
          })) });
        } catch { /* Leave old data intact; try the next usable version. */ }
      }
    }
    return null;
  }
  function buildCSV(draft) {
    const rows = [['Timestamp', 'Comments']];
    for (const note of draft.notes.slice().sort((a, b) => a.t - b.t)) {
      rows.push([formatTime(note.t, true) + (note.end != null ? '–' + formatTime(note.end, true) : ''), note.note]);
    }
    return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }
  globalThis.ReviewCutCore = Object.freeze({ id, vimeo, parseTime, formatTime, cleanDraft, migrateLegacy, buildCSV });
})();
