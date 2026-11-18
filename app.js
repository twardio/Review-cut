/* One video, timestamped notes, one CSV. No backend. */
(() => {
  'use strict';
  const C = ReviewCutCore, $ = id => document.getElementById(id), KEY = 'reviewcut-lite-draft';
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const blankForm = () => ({time:'00:00',text:'',editing:null});
  let draft = {schema:2,source:'',notes:[],form:blankForm()}, lastSaved = null, saveBlocked = false;
  let player, ready = false, duration = 0, playhead = 0, generation = 0, sdk, saveTimer, captureToken = 0, manualTime = false;
  function warning(text) {
    $('storage-warning').textContent = text; $('storage-warning').hidden = !text;
    if (text) $('save-info').textContent = 'Saving is paused. Export your feedback before closing this page.';
  }
  try {
    lastSaved = localStorage.getItem(KEY);
    if (lastSaved) draft = C.cleanDraft(JSON.parse(lastSaved));
    else {
      const previous = localStorage.getItem('reviewcut-lite-v1');
      if (previous) draft = C.migrateLegacy(JSON.parse(previous)) || draft;
    }
  } catch { saveBlocked = true; warning('Browser saving is unavailable. Export your feedback before closing this page. Existing saved data has been left untouched.'); }
  function save() {
    clearTimeout(saveTimer);
    if (saveBlocked) return;
    try {
      if (localStorage.getItem(KEY) !== lastSaved) throw Error('conflict');
      const next = JSON.stringify(draft); localStorage.setItem(KEY,next); lastSaved = next;
    } catch (e) {
      saveBlocked = true;
      warning(e.message === 'conflict' ? 'Another tab changed this draft. Export your feedback here, then reload to open that copy. Saving is paused.' : 'This draft could not be saved. Export your feedback before closing this page.');
    }
  }
  function queueSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save,250); }
  function error(id,text) { $(id).textContent = text; $(id).hidden = !text; }
  function renderForm() {
    $('timestamp').value = draft.form.time; $('feedback').value = draft.form.text;
    $('add-feedback').textContent = draft.form.editing ? 'Save changes' : 'Add feedback';
    $('cancel-edit').hidden = !draft.form.editing;
    manualTime = !!draft.form.text || !!draft.form.editing;
  }
  function renderNotes() {
    $('notes').innerHTML = draft.notes.slice().sort((a,b) => a.t-b.t).map(n => `<li><div class="note-top"><a class="note-time" href="${escape(C.vimeo(draft.source).url)}#t=${Math.floor(n.t)}s" target="_blank" rel="noopener noreferrer" data-seek="${n.id}" title="Go to this moment">${C.formatTime(n.t,true)}${n.end != null ? '–'+C.formatTime(n.end,true) : ''}</a><div class="note-buttons"><button type="button" data-edit="${n.id}">Edit</button><button type="button" data-remove="${n.id}">Remove</button></div></div><p class="note-text">${escape(n.note)}</p></li>`).join('');
    $('empty-notes').hidden = draft.notes.length > 0; $('export-csv').disabled = draft.notes.length === 0;
    $('export-count').textContent = draft.notes.length ? draft.notes.length+' comment'+(draft.notes.length === 1 ? '' : 's')+' ready to download.' : 'Add your first comment to enable the download.';
    $('export-message').textContent = '';
  }
  function resetForm() { captureToken++; draft.form = {...blankForm(),time:C.formatTime(playhead,true)}; manualTime = false; renderForm(); error('feedback-error',''); }
  $('start-new').addEventListener('click',() => {
    if ((draft.notes.length || draft.form.text.trim()) && !confirm('Start a new video? This clears the saved video and feedback, then refreshes the page. Download your CSV first if you need to keep it.')) return;
    try {
      // Remove only ReviewCut data, including legacy reviews that could be restored.
      localStorage.removeItem('reviewcut-lite-v1');
      localStorage.removeItem(KEY);
    } catch {
      warning('The saved draft could not be cleared. Export your feedback, then allow browser storage and try again.');
      return;
    }
    clearTimeout(saveTimer); lastSaved = null; saveBlocked = false;
    generation++; captureToken++; ready = false; duration = 0; playhead = 0;
    const old = player; player = null;
    if (old) old.destroy().catch(() => {});
    draft = {schema:2,source:'',notes:[],form:blankForm()};
    $('video').replaceChildren(); $('workspace').hidden = true; $('start-new').hidden = true;
    $('video-url').value = ''; $('player-message').textContent = '';
    resetForm(); renderNotes(); error('link-error','');
    // Unload handlers must save the empty draft, never the discarded feedback.
    save(); window.location.reload();
  });
  function loadSDK() {
    if (window.Vimeo?.Player) return Promise.resolve();
    if (!sdk) sdk = new Promise((resolve,reject) => {
      const script = document.createElement('script'); script.src = 'https://player.vimeo.com/api/player.js'; script.async = true;
      script.onload = () => window.Vimeo?.Player ? resolve() : reject(Error('Vimeo unavailable'));
      script.onerror = () => { sdk = null; script.remove(); reject(Error('Vimeo unavailable')); }; document.head.append(script);
    });
    return sdk;
  }
  function timed(promise, ms = 12000) {
    let timer;
    return Promise.race([promise,new Promise((_,reject) => { timer = setTimeout(() => reject(Error('timeout')),ms); })]).finally(() => clearTimeout(timer));
  }
  async function mountVideo() {
    const current = ++generation; captureToken++; ready = false; duration = 0; playhead = 0;
    const old = player; player = null;
    if (old) old.destroy().catch(() => {});
    const frame = document.createElement('iframe'); frame.src = C.vimeo(draft.source).embed; frame.title = 'Vimeo video';
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox');
    frame.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media'; frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
    $('video').replaceChildren(frame); $('workspace').hidden = false;
    const message = text => { if (current === generation) $('player-message').textContent = text; };
    message('Loading Vimeo… You can enter timestamps manually.');
    try {
      await timed(loadSDK()); if (current !== generation) return;
      const instance = new Vimeo.Player(frame); player = instance;
      instance.on('timeupdate',e => {
        if (current !== generation) return;
        playhead = e.seconds; duration = e.duration || duration;
        if (!manualTime && !draft.form.text && !draft.form.editing && document.activeElement !== $('timestamp')) {
          draft.form.time = C.formatTime(e.seconds,true); $('timestamp').value = draft.form.time;
        }
      });
      instance.on('error',() => message('Vimeo cannot play this video. Check its embedding and privacy settings, or enter timestamps manually.'));
      await timed(instance.ready()); if (current !== generation) return;
      ready = true;
      message('Start typing feedback to pause the video and capture its time.');
      instance.getDuration().then(n => { if (current === generation && Number.isFinite(n)) duration = n; }).catch(() => {});
    } catch { message('Automatic timestamps are unavailable. Use Vimeo’s controls and type the timestamp yourself.'); }
  }
  async function captureTime() {
    if (!ready) return;
    const token = ++captureToken, current = generation, instance = player;
    try {
      const seconds = manualTime || draft.form.editing ? null : await timed(instance.getCurrentTime(),1500);
      if (current !== generation || token !== captureToken) return;
      if (seconds != null && Number.isFinite(seconds)) { draft.form.time = C.formatTime(seconds,true); $('timestamp').value = draft.form.time; }
      manualTime = true; queueSave();
      await timed(instance.pause(),1500);
    } catch { /* The timestamp remains editable if Vimeo does not answer. */ }
  }
  $('link-form').addEventListener('submit',e => {
    e.preventDefault(); error('link-error','');
    let source;
    try { source = C.vimeo($('video-url').value).url; } catch (err) { error('link-error',err.message); $('video-url').focus(); return; }
    if (draft.source && source !== draft.source && (draft.notes.length || draft.form.text.trim()) && !confirm('Load a different video and clear this feedback? Export your CSV first if you need to keep it.')) return;
    if (source !== draft.source) { playhead = 0; draft.source = source; draft.notes = []; resetForm(); }
    $('video-url').value = source; $('start-new').hidden = false; save(); renderNotes(); mountVideo();
  });
  $('timestamp').addEventListener('input',() => { captureToken++; manualTime = true; draft.form.time = $('timestamp').value; error('feedback-error',''); queueSave(); });
  $('feedback').addEventListener('focus',captureTime);
  $('feedback').addEventListener('input',() => { draft.form.text = $('feedback').value; error('feedback-error',''); queueSave(); });
  $('feedback-form').addEventListener('submit',e => {
    e.preventDefault(); const t = C.parseTime($('timestamp').value), note = $('feedback').value.trim();
    if (!Number.isFinite(t)) { error('feedback-error','Enter a timestamp as seconds, mm:ss or hh:mm:ss.'); $('timestamp').focus(); return; }
    if (duration && t > duration + .1) { error('feedback-error','This timestamp is beyond the end of the video.'); $('timestamp').focus(); return; }
    if (!note) { error('feedback-error','Write your feedback first.'); $('feedback').focus(); return; }
    const existing = draft.notes.find(n => n.id === draft.form.editing);
    if (existing) { existing.t = t; existing.note = note; if (existing.end != null && existing.end <= t) existing.end = null; }
    else {
      if (draft.notes.length >= 20000) { error('feedback-error','Export these notes and load a new video before adding more.'); return; }
      draft.notes.push({id:C.id(),t,end:null,note});
    }
    resetForm(); save(); renderNotes(); $('export-message').textContent = existing ? 'Feedback updated.' : 'Feedback added at '+C.formatTime(t,true)+'.';
  });
  $('cancel-edit').addEventListener('click',() => { resetForm(); save(); });
  $('notes').addEventListener('click',async e => {
    const edit = e.target.closest('[data-edit]'), remove = e.target.closest('[data-remove]'), seek = e.target.closest('[data-seek]');
    const id = edit?.dataset.edit || remove?.dataset.remove || seek?.dataset.seek, note = draft.notes.find(n => n.id === id);
    if (!note) return;
    if (edit) { captureToken++; draft.form = {time:C.formatTime(note.t,true),text:note.note,editing:note.id}; renderForm(); save(); $('feedback').focus(); }
    if (remove) { draft.notes = draft.notes.filter(n => n.id !== id); if (draft.form.editing === id) resetForm(); save(); renderNotes(); }
    if (seek && ready) {
      e.preventDefault();
      try { await timed(player.setCurrentTime(note.t),3000); } catch { $('player-message').textContent = 'Vimeo could not jump to that moment. Use its timeline instead.'; }
    }
  });
  $('export-csv').addEventListener('click',() => {
    if (draft.form.text.trim()) { error('feedback-error',draft.form.editing ? 'Save this change before exporting.' : 'Add this feedback before exporting.'); $('feedback').focus(); return; }
    if (!draft.notes.length) return;
    const url = URL.createObjectURL(new Blob([C.buildCSV(draft)],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a'); a.href = url; a.download = 'reviewcut-feedback-'+C.vimeo(draft.source).id+'.csv'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url),60000); $('export-message').textContent = 'CSV download started. Send it to the video editor.';
  });
  window.addEventListener('storage',e => { if (e.key === KEY && e.newValue !== lastSaved) { saveBlocked = true; warning('Another tab changed this draft. Export your feedback here, then reload to open that copy. Saving is paused.'); } });
  window.addEventListener('pagehide',save);
  document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('beforeunload',e => { save(); if (saveBlocked && (draft.notes.length || draft.form.text.trim())) { e.preventDefault(); e.returnValue = ''; } });
  // Old review data is kept untouched. Continue only its most recently opened cut.
  $('video-url').value = draft.source; $('start-new').hidden = !draft.source; renderForm(); renderNotes();
  if (draft.source) { save(); mountVideo(); }
})();
