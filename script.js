/* StudySprint Part 3: browser-only prototype with local persistence. */
(() => {
  'use strict';
  const STORAGE_KEY = 'studysprint_assignments_v2';
  const $ = (id) => document.getElementById(id);
  const form = $('assignment-form');
  const list = $('assignment-list');
  const empty = $('empty-state');
  const status = $('form-status');
  const dateInput = $('assignment-date');
  let assignments = loadAssignments();
  let pendingDeleteId = null;
  let timerSeconds = 25 * 60;
  let timerInterval = null;
  let timerRunning = false;

  function localISODate(date = new Date()) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
  }
  dateInput.min = localISODate();
  function loadAssignments() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(a => a && typeof a.id === 'string' && typeof a.name === 'string' && Array.isArray(a.tasks)) : [];
    } catch (error) { return []; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments)); return true; }
    catch (error) { status.textContent = 'Browser storage is unavailable or full. Your latest change may not persist.'; return false; }
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }
  function formatDate(iso) {
    if (!iso) return 'No due date';
    const d = new Date(`${iso}T12:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, {day:'numeric',month:'short',year:'numeric'});
  }
  function progress(a) { return a.tasks.length ? Math.round(a.tasks.filter(t => t.done).length / a.tasks.length * 100) : 0; }
  function updateStats() {
    $('stat-total').textContent = assignments.length;
    $('stat-done').textContent = assignments.reduce((sum, a) => sum + a.tasks.filter(t => t.done).length, 0);
    const today = localISODate();
    $('stat-upcoming').textContent = assignments.filter(a => a.dueDate >= today && progress(a) < 100).length;
  }
  function render() {
    list.innerHTML = '';
    empty.hidden = assignments.length > 0;
    assignments.forEach(a => {
      const pct = progress(a);
      const card = document.createElement('article');
      card.className = 'assignment-card';
      card.innerHTML = `<div class="assignment-top"><div><span class="course-label">${escapeHTML(a.course || 'MY ASSIGNMENT')}</span><h3>${escapeHTML(a.name)}</h3><p class="due-date">Due ${escapeHTML(formatDate(a.dueDate))}</p></div><div class="card-actions"><button type="button" class="small-action" data-edit="${escapeHTML(a.id)}" aria-label="Edit ${escapeHTML(a.name)}">Edit</button><button type="button" class="small-action" data-delete="${escapeHTML(a.id)}" aria-label="Delete ${escapeHTML(a.name)}">Delete</button></div></div><div class="progress-line" role="progressbar" aria-label="${escapeHTML(a.name)} completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div><div class="progress-meta"><span>${a.tasks.filter(t => t.done).length} of ${a.tasks.length} tasks complete</span><strong>${pct}%</strong></div><button type="button" class="task-toggle" aria-expanded="${a.expanded !== false}" aria-controls="tasks-${escapeHTML(a.id)}" data-toggle="${escapeHTML(a.id)}"><span>Task checklist</span><span aria-hidden="true">${a.expanded !== false ? '−' : '+'}</span></button><ul class="task-list" id="tasks-${escapeHTML(a.id)}" ${a.expanded === false ? 'hidden' : ''}>${a.tasks.map(t => `<li class="task-row ${t.done ? 'done' : ''}"><input type="checkbox" id="task-${escapeHTML(a.id)}-${escapeHTML(t.id)}" data-task="${escapeHTML(t.id)}" data-assignment="${escapeHTML(a.id)}" ${t.done ? 'checked' : ''}><label for="task-${escapeHTML(a.id)}-${escapeHTML(t.id)}"><span>${escapeHTML(t.text)}</span></label></li>`).join('')}</ul><form class="add-task" data-add-task="${escapeHTML(a.id)}"><label class="visually-hidden" for="new-task-${escapeHTML(a.id)}">New task for ${escapeHTML(a.name)}</label><input id="new-task-${escapeHTML(a.id)}" name="new-task" maxlength="120" placeholder="Add a small task" required><button type="submit">Add</button></form>`;
      list.appendChild(card);
    });
    updateStats();
  }
  function openForm(a = null) {
    form.hidden = false;
    $('form-heading').textContent = a ? 'Edit assignment' : 'Add an assignment';
    $('assignment-id').value = a ? a.id : '';
    $('assignment-name').value = a ? a.name : '';
    $('assignment-date').value = a ? a.dueDate : '';
    $('assignment-course').value = a ? a.course : '';
    $('assignment-tasks').value = a ? a.tasks.map(t => t.text).join('\n') : '';
    status.textContent = '';
    $('assignment-name').focus();
    form.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'center'});
  }
  function closeForm() { form.hidden = true; form.reset(); $('assignment-id').value = ''; }
  $('show-form').addEventListener('click', () => openForm());
  $('empty-add').addEventListener('click', () => openForm());
  $('close-form').addEventListener('click', closeForm);
  $('cancel-form').addEventListener('click', closeForm);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const name = $('assignment-name').value.trim();
    const dueDate = $('assignment-date').value;
    const course = $('assignment-course').value.trim();
    if (!name || !dueDate) { status.textContent = 'Please enter an assignment name and due date.'; return; }
    const id = $('assignment-id').value;
    const taskLines = $('assignment-tasks').value.split('\n').map(t => t.trim()).filter(Boolean);
    if (id) {
      const a = assignments.find(item => item.id === id);
      if (!a) return;
      a.name = name; a.dueDate = dueDate; a.course = course;
      if (taskLines.length) {
        const oldTasks = a.tasks;
        a.tasks = taskLines.map(text => { const old = oldTasks.find(t => t.text.toLowerCase() === text.toLowerCase()); return old ? {...old, text} : {id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(), text, done:false}; });
      }
      status.textContent = 'Assignment updated.';
    } else {
      const tasks = taskLines.length ? taskLines : ['Read the brief', 'Complete the main work', 'Review and submit'];
      assignments.unshift({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), name, dueDate, course, expanded:true, tasks:tasks.map((text,i) => ({id:`t${Date.now()}${i}`,text,done:false}))});
      status.textContent = 'Assignment added. Your plan is saved in this browser.';
    }
    persist(); closeForm(); render(); $('assignment-heading').focus?.();
  });
  list.addEventListener('change', event => {
    const box = event.target.closest('input[data-task]'); if (!box) return;
    const a = assignments.find(item => item.id === box.dataset.assignment); const t = a?.tasks.find(item => item.id === box.dataset.task);
    if (t) { t.done = box.checked; persist(); render(); status.textContent = t.done ? 'Task marked complete.' : 'Task marked incomplete.'; }
  });
  list.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle]');
    if (toggle) { const a = assignments.find(item => item.id === toggle.dataset.toggle); if (a) { a.expanded = a.expanded === false; persist(); render(); } return; }
    const edit = event.target.closest('[data-edit]');
    if (edit) { const a = assignments.find(item => item.id === edit.dataset.edit); if (a) openForm(a); return; }
    const del = event.target.closest('[data-delete]');
    if (del) { pendingDeleteId = del.dataset.delete; const dialog = $('confirm-dialog'); if (dialog.showModal) dialog.showModal(); else if (confirm('Delete this assignment?')) deletePending(); }
  });
  function deletePending() { assignments = assignments.filter(a => a.id !== pendingDeleteId); pendingDeleteId = null; persist(); render(); status.textContent = 'Assignment deleted.'; }
  $('confirm-delete').addEventListener('click', event => { if (pendingDeleteId) { event.preventDefault(); deletePending(); $('confirm-dialog').close(); } });
  list.addEventListener('submit', event => {
    const taskForm = event.target.closest('[data-add-task]'); if (!taskForm) return;
    event.preventDefault(); const input = taskForm.querySelector('input[name="new-task"]'); const text = input.value.trim(); if (!text) return;
    const a = assignments.find(item => item.id === taskForm.dataset.addTask); if (!a) return;
    a.tasks.push({id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(), text, done:false}); a.expanded = true; persist(); render(); status.textContent = 'Task added to your checklist.';
  });
  function updateTimerDisplay() { const mins = Math.floor(timerSeconds/60); const secs = timerSeconds%60; $('timer').textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`; $('timer').setAttribute('aria-label', `${mins} minutes and ${secs} seconds remaining`); }
  function stopTimer() { clearInterval(timerInterval); timerInterval = null; timerRunning = false; $('timer-start').textContent = 'Resume focus'; }
  $('timer-start').addEventListener('click', () => {
    if (timerRunning) { stopTimer(); $('timer-status').textContent = 'Focus session paused.'; return; }
    if (timerSeconds <= 0) timerSeconds = 25*60;
    timerRunning = true; $('timer-start').textContent = 'Pause'; $('timer-status').textContent = 'Focus session in progress. You can pause whenever you need.';
    timerInterval = setInterval(() => { timerSeconds--; updateTimerDisplay(); if (timerSeconds <= 0) { stopTimer(); $('timer-mode').textContent = 'SESSION COMPLETE'; $('timer-status').textContent = 'Well done. Take a short break before your next task.'; $('timer-start').textContent = 'Start again'; } }, 1000);
  });
  $('timer-reset').addEventListener('click', () => { stopTimer(); timerSeconds=25*60; $('timer-mode').textContent='FOCUS SESSION'; $('timer-status').textContent='Timer reset. Ready when you are.'; $('timer-start').textContent='Start focus'; updateTimerDisplay(); });
  render(); updateTimerDisplay();
})();
