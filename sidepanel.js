"use strict";

const STORAGE_KEY = "todoAppState";
const FILTERS = new Set(["open", "done", "all"]);

const PRIORITY_META = {
  high: { short: "高", full: "高优先级", rank: 0 },
  medium: { short: "中", full: "中优先级", rank: 1 },
  low: { short: "低", full: "低优先级", rank: 2 },
  none: { short: "普通", full: "普通", rank: 3 }
};

const ICONS = {
  check:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.3 8.3 2.9 2.8 6.5-6.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4.25v11.5M4.25 10h11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  edit:
    '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m12.5 4.2 3.3 3.3M4 16l.7-3.5 8.5-8.5a1.6 1.6 0 0 1 2.3 0l.5.5a1.6 1.6 0 0 1 0 2.3l-8.5 8.5L4 16Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  calendar:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.3" y="3.5" width="11.4" height="10.2" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M5.2 2.2v2.6M10.8 2.2v2.6M2.5 6.4h11" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  bell:
    '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4.2 6.9a3.8 3.8 0 0 1 7.6 0c0 3 1.3 3.7 1.3 3.7H2.9s1.3-.7 1.3-3.7ZM6.5 13a1.7 1.7 0 0 0 3 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clipboard:
    '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="6.5" y="6" width="19" height="21" rx="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 6V4.8A1.8 1.8 0 0 1 13.8 3h4.4A1.8 1.8 0 0 1 20 4.8V6M11 12.5h10M11 17h7.5M11 21.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};

const refs = {};
let appState = emptyState();
let currentFilter = "open";
let groupRowSequence = 0;
let toastTimer = null;
let toastHideTimer = null;
let datetimePickerTarget = null;
let calendarView = { year: 0, month: 0 };
let calendarSelection = {
  year: 0,
  month: 0,
  day: 1,
  hour: 0,
  minute: 0
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

async function init() {
  cacheRefs();
  bindEvents();
  await loadState();
  applyFilterUI();
  render();
}

function cacheRefs() {
  refs.summary = document.getElementById("summary");
  refs.taskArea = document.getElementById("taskArea");
  refs.newTodoButton = document.getElementById("newTodoButton");
  refs.newGroupButton = document.getElementById("newGroupButton");
  refs.filterTabs = Array.from(document.querySelectorAll(".filter-tab"));

  refs.todoDialog = document.getElementById("todoDialog");
  refs.todoForm = document.getElementById("todoForm");
  refs.todoDialogTitle = document.getElementById("todoDialogTitle");
  refs.todoId = document.getElementById("todoId");
  refs.todoName = document.getElementById("todoName");
  refs.todoNote = document.getElementById("todoNote");
  refs.todoGroup = document.getElementById("todoGroup");
  refs.todoDue = document.getElementById("todoDue");
  refs.todoReminder = document.getElementById("todoReminder");
  refs.todoError = document.getElementById("todoError");
  refs.deleteTodoButton = document.getElementById("deleteTodoButton");

  refs.groupDialog = document.getElementById("groupDialog");
  refs.groupForm = document.getElementById("groupForm");
  refs.groupName = document.getElementById("groupName");
  refs.groupTaskCount = document.getElementById("groupTaskCount");
  refs.groupRows = document.getElementById("groupRows");
  refs.addGroupTaskButton = document.getElementById("addGroupTaskButton");
  refs.groupError = document.getElementById("groupError");
  refs.groupTaskTemplate = document.getElementById("groupTaskTemplate");

  refs.groupEditDialog = document.getElementById("groupEditDialog");
  refs.groupEditForm = document.getElementById("groupEditForm");
  refs.editGroupId = document.getElementById("editGroupId");
  refs.editGroupName = document.getElementById("editGroupName");
  refs.groupEditError = document.getElementById("groupEditError");
  refs.deleteGroupButton = document.getElementById("deleteGroupButton");

  refs.confirmDialog = document.getElementById("confirmDialog");
  refs.confirmTitle = document.getElementById("confirmTitle");
  refs.confirmMessage = document.getElementById("confirmMessage");
  refs.confirmAccept = document.getElementById("confirmAccept");

  refs.datePickerDialog = document.getElementById("datePickerDialog");
  refs.datePickerTitle = document.getElementById("datePickerTitle");
  refs.calendarPrev = document.getElementById("calendarPrev");
  refs.calendarNext = document.getElementById("calendarNext");
  refs.calendarToday = document.getElementById("calendarToday");
  refs.calendarMonthLabel = document.getElementById("calendarMonthLabel");
  refs.calendarGrid = document.getElementById("calendarGrid");
  refs.datetimeHour = document.getElementById("datetimeHour");
  refs.datetimeMinute = document.getElementById("datetimeMinute");
  refs.datetimeSelectionLabel = document.getElementById(
    "datetimeSelectionLabel"
  );
  refs.datetimeError = document.getElementById("datetimeError");
  refs.clearDateTimeButton = document.getElementById(
    "clearDateTimeButton"
  );
  refs.confirmDateTimeButton = document.getElementById(
    "confirmDateTimeButton"
  );

  refs.toast = document.getElementById("toast");
}

function bindEvents() {
  refs.newTodoButton.addEventListener("click", () => openTodoDialog());
  refs.newGroupButton.addEventListener("click", openGroupDialog);

  for (const tab of refs.filterTabs) {
    tab.addEventListener("click", () => setFilter(tab.dataset.filter));
  }

  refs.taskArea.addEventListener("click", handleTaskAreaClick);

  refs.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTodoFromForm();
  });
  refs.todoForm.addEventListener("input", () => clearError(refs.todoError));
  refs.deleteTodoButton.addEventListener("click", deleteCurrentTodo);

  refs.groupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGroupFromForm();
  });
  refs.groupForm.addEventListener("input", () => clearError(refs.groupError));
  refs.addGroupTaskButton.addEventListener("click", () => {
    addGroupTaskRow({}, true);
  });
  refs.groupRows.addEventListener("click", handleGroupRowClick);

  refs.groupEditForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveGroupEdit();
  });
  refs.groupEditForm.addEventListener("input", () =>
    clearError(refs.groupEditError)
  );
  refs.deleteGroupButton.addEventListener("click", deleteCurrentGroup);

  document.addEventListener("click", handleDateTimeTriggerClick);
  refs.calendarPrev.addEventListener("click", () => shiftCalendarMonth(-1));
  refs.calendarNext.addEventListener("click", () => shiftCalendarMonth(1));
  refs.calendarToday.addEventListener("click", selectToday);
  refs.calendarGrid.addEventListener("click", handleCalendarGridClick);
  refs.calendarGrid.addEventListener("keydown", handleCalendarKeydown);
  refs.datetimeHour.addEventListener(
    "input",
    updateDateTimeSelectionLabel
  );
  refs.datetimeMinute.addEventListener(
    "input",
    updateDateTimeSelectionLabel
  );
  refs.confirmDateTimeButton.addEventListener(
    "click",
    confirmDateTimePicker
  );
  refs.clearDateTimeButton.addEventListener("click", clearDateTimePicker);
  refs.datePickerDialog.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      (event.target === refs.datetimeHour ||
        event.target === refs.datetimeMinute)
    ) {
      event.preventDefault();
      confirmDateTimePicker();
    }
  });
  refs.datePickerDialog.addEventListener("close", () => {
    datetimePickerTarget = null;
    clearError(refs.datetimeError);
  });

  for (const button of document.querySelectorAll("[data-close]")) {
    button.addEventListener("click", () => {
      button.closest("dialog")?.close();
    });
  }

  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEY]) return;

    appState = normalizeState(changes[STORAGE_KEY].newValue);
    render();
  });
}

async function loadState() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    appState = normalizeState(result[STORAGE_KEY]);
  } catch (error) {
    console.error("[待办助手] 读取数据失败：", error);
    appState = emptyState();
    showToast("读取数据失败，请刷新侧栏重试");
  }
}

async function persistState() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: appState });
  } catch (error) {
    console.error("[待办助手] 保存数据失败：", error);
    showToast("保存失败，请重试");
    throw error;
  }
}

function emptyState() {
  return { version: 1, groups: [], todos: [] };
}

function normalizeState(raw) {
  if (!raw || typeof raw !== "object") return emptyState();

  const groups = [];
  const groupIds = new Set();

  if (Array.isArray(raw.groups)) {
    for (const candidate of raw.groups) {
      if (
        !candidate ||
        typeof candidate.id !== "string" ||
        groupIds.has(candidate.id)
      ) {
        continue;
      }

      const name =
        typeof candidate.name === "string" ? candidate.name.trim() : "";

      if (!name) continue;

      groups.push({
        id: candidate.id,
        name: name.slice(0, 80),
        createdAt: finiteOr(candidate.createdAt, Date.now())
      });
      groupIds.add(candidate.id);
    }
  }

  const todos = [];
  const todoIds = new Set();

  if (Array.isArray(raw.todos)) {
    for (const candidate of raw.todos) {
      if (
        !candidate ||
        typeof candidate.id !== "string" ||
        todoIds.has(candidate.id)
      ) {
        continue;
      }

      const name =
        typeof candidate.name === "string" ? candidate.name.trim() : "";
      if (!name) continue;

      const priority =
        candidate.priority && PRIORITY_META[candidate.priority]
          ? candidate.priority
          : "none";
      const dueAt = finiteOrNull(candidate.dueAt);
      const reminderAt = finiteOrNull(candidate.reminderAt);

      todos.push({
        id: candidate.id,
        name: name.slice(0, 120),
        note:
          typeof candidate.note === "string"
            ? candidate.note.slice(0, 1000)
            : "",
        priority,
        dueAt,
        reminderAt,
        reminderNotifiedAt: finiteOrNull(candidate.reminderNotifiedAt),
        completed: Boolean(candidate.completed),
        completedAt: finiteOrNull(candidate.completedAt),
        groupId:
          typeof candidate.groupId === "string" &&
          groupIds.has(candidate.groupId)
            ? candidate.groupId
            : null,
        createdAt: finiteOr(candidate.createdAt, Date.now()),
        updatedAt: finiteOr(candidate.updatedAt, Date.now())
      });
      todoIds.add(candidate.id);
    }
  }

  return { version: 1, groups, todos };
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function setFilter(filter) {
  if (!FILTERS.has(filter)) return;

  currentFilter = filter;
  applyFilterUI();
  renderTaskArea();
}

function applyFilterUI() {
  for (const tab of refs.filterTabs) {
    const isActive = tab.dataset.filter === currentFilter;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }
}

function render() {
  renderSummary();
  renderTaskArea();
}

function renderSummary() {
  const openTodos = appState.todos.filter((todo) => !todo.completed);

  if (appState.todos.length === 0) {
    refs.summary.textContent = "把想法变成清晰的下一步";
    return;
  }

  if (openTodos.length === 0) {
    refs.summary.textContent = `全部完成 · 共 ${appState.todos.length} 条待办`;
    return;
  }

  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const overdueCount = openTodos.filter(
    (todo) => Number.isFinite(todo.dueAt) && todo.dueAt < now
  ).length;
  const dueTodayCount = openTodos.filter(
    (todo) =>
      Number.isFinite(todo.dueAt) &&
      todo.dueAt >= todayStart.getTime() &&
      todo.dueAt < todayEnd.getTime() &&
      todo.dueAt >= now
  ).length;

  const parts = [`${openTodos.length} 条待办`];

  if (overdueCount > 0) {
    parts.push(`${overdueCount} 条已逾期`);
  } else if (dueTodayCount > 0) {
    parts.push(`${dueTodayCount} 条今日到期`);
  }

  refs.summary.textContent = parts.join(" · ");
}

function renderTaskArea() {
  const visibleTodos = appState.todos.filter((todo) => {
    if (currentFilter === "open") return !todo.completed;
    if (currentFilter === "done") return todo.completed;
    return true;
  });

  const sortedTodos = sortTodos(visibleTodos);
  const todosByGroup = new Map(appState.groups.map((group) => [group.id, []]));
  const ungroupedTodos = [];

  for (const todo of sortedTodos) {
    const bucket = todo.groupId ? todosByGroup.get(todo.groupId) : null;
    if (bucket) {
      bucket.push(todo);
    } else {
      ungroupedTodos.push(todo);
    }
  }

  const fragment = document.createDocumentFragment();
  let sectionCount = 0;

  for (const group of appState.groups) {
    const groupTodos = todosByGroup.get(group.id) || [];
    const totalInGroup = appState.todos.some(
      (todo) => todo.groupId === group.id
    );

    // 在“全部”中保留空分组，方便继续添加或管理分组。
    if (
      groupTodos.length === 0 &&
      !(currentFilter === "all" && !totalInGroup)
    ) {
      continue;
    }

    fragment.append(createGroupSection(group, groupTodos));
    sectionCount += 1;
  }

  if (ungroupedTodos.length > 0) {
    fragment.append(createGroupSection(null, ungroupedTodos));
    sectionCount += 1;
  }

  if (sectionCount === 0) {
    fragment.append(createEmptyState());
  }

  refs.taskArea.replaceChildren(fragment);
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    if (a.completed && b.completed) {
      const completedDiff = (b.completedAt || 0) - (a.completedAt || 0);
      if (completedDiff !== 0) return completedDiff;
    }

    const aDue = Number.isFinite(a.dueAt) ? a.dueAt : Number.POSITIVE_INFINITY;
    const bDue = Number.isFinite(b.dueAt) ? b.dueAt : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    const priorityDiff =
      (PRIORITY_META[a.priority]?.rank ?? 3) -
      (PRIORITY_META[b.priority]?.rank ?? 3);
    if (priorityDiff !== 0) return priorityDiff;

    return a.createdAt - b.createdAt;
  });
}

function createGroupSection(group, todos) {
  const isLoose = !group;
  const section = document.createElement("section");
  section.className = `task-section group${isLoose ? " group-plain" : ""}`;
  if (group) section.dataset.groupId = group.id;

  const header = document.createElement("header");
  header.className = "group-header";

  const title = document.createElement("div");
  title.className = "group-title";

  const marker = document.createElement("span");
  marker.className = "group-marker";
  marker.setAttribute("aria-hidden", "true");

  const heading = document.createElement("h2");
  heading.textContent = isLoose ? "单独待办" : group.name;
  heading.title = heading.textContent;

  const count = document.createElement("span");
  count.className = "group-count";
  count.textContent = String(todos.length);

  title.append(marker, heading, count);
  header.append(title);

  if (group) {
    const actions = document.createElement("div");
    actions.className = "group-actions";

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "icon-button";
    addButton.dataset.action = "add-to-group";
    addButton.dataset.groupId = group.id;
    addButton.title = `向「${group.name}」添加待办`;
    addButton.setAttribute("aria-label", addButton.title);
    addButton.innerHTML = ICONS.plus;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-button";
    editButton.dataset.action = "edit-group";
    editButton.dataset.groupId = group.id;
    editButton.title = `编辑分组「${group.name}」`;
    editButton.setAttribute("aria-label", editButton.title);
    editButton.innerHTML = ICONS.edit;

    actions.append(addButton, editButton);
    header.append(actions);
  }

  section.append(header);

  if (todos.length === 0) {
    const empty = document.createElement("p");
    empty.className = "group-empty";
    empty.textContent = "这个分组还没有待办";
    section.append(empty);
  } else {
    const list = document.createElement("div");
    list.className = "task-list";

    for (const todo of todos) {
      list.append(createTaskCard(todo));
    }

    section.append(list);
  }

  return section;
}

function createTaskCard(todo) {
  const card = document.createElement("article");
  card.className = `task-card${todo.completed ? " is-completed" : ""}`;
  card.dataset.id = todo.id;
  card.dataset.priority = todo.priority;

  const check = document.createElement("button");
  check.type = "button";
  check.className = "task-check";
  check.dataset.action = "toggle-todo";
  check.dataset.id = todo.id;
  check.setAttribute("role", "checkbox");
  check.setAttribute("aria-checked", String(todo.completed));
  check.setAttribute(
    "aria-label",
    todo.completed
      ? `将「${todo.name}」标记为未完成`
      : `完成「${todo.name}」`
  );
  check.title = todo.completed ? "标记为未完成" : "标记为已完成";
  check.innerHTML = ICONS.check;

  const content = document.createElement("div");
  content.className = "task-content";

  const headingRow = document.createElement("div");
  headingRow.className = "task-heading";

  const priority = PRIORITY_META[todo.priority] || PRIORITY_META.none;
  const priorityChip = document.createElement("span");
  priorityChip.className = `priority-chip ${todo.priority}`;
  priorityChip.textContent = priority.short;
  priorityChip.title = priority.full;

  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = todo.name;

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "icon-button task-edit";
  editButton.dataset.action = "edit-todo";
  editButton.dataset.id = todo.id;
  editButton.title = "编辑待办";
  editButton.setAttribute("aria-label", `编辑「${todo.name}」`);
  editButton.innerHTML = ICONS.edit;

  headingRow.append(priorityChip, title, editButton);
  content.append(headingRow);

  if (todo.note) {
    const note = document.createElement("p");
    note.className = "task-note";
    note.textContent = todo.note;
    content.append(note);
  }

  const meta = document.createElement("div");
  meta.className = "task-meta";

  if (Number.isFinite(todo.dueAt)) {
    const isOverdue = !todo.completed && todo.dueAt < Date.now();
    const dueText = isOverdue
      ? `已逾期 · ${formatDateTime(todo.dueAt)}`
      : `截止 ${formatDateTime(todo.dueAt)}`;
    meta.append(
      createMetaItem(
        ICONS.calendar,
        dueText,
        isOverdue ? ["is-overdue"] : [],
        formatFullDateTime(todo.dueAt)
      )
    );
  }

  if (Number.isFinite(todo.reminderAt)) {
    const isPast = todo.reminderAt <= Date.now();
    const classes = ["is-reminder"];

    if (todo.completed) {
      classes.push("is-done");
    } else if (isPast) {
      classes.push("is-past");
    }

    const reminderText =
      isPast && !todo.completed
        ? `提醒已过 · ${formatDateTime(todo.reminderAt)}`
        : `提醒 ${formatDateTime(todo.reminderAt)}`;

    meta.append(
      createMetaItem(
        ICONS.bell,
        reminderText,
        classes,
        formatFullDateTime(todo.reminderAt)
      )
    );
  }

  if (meta.childElementCount > 0) content.append(meta);

  card.append(check, content);
  return card;
}

function createMetaItem(icon, text, classes = [], title = text) {
  const item = document.createElement("span");
  item.className = ["meta-item", ...classes].join(" ");
  item.title = title;
  item.innerHTML = icon;

  const label = document.createElement("span");
  label.textContent = text;
  item.append(label);

  return item;
}

function createEmptyState() {
  const wrapper = document.createElement("div");
  wrapper.className = "empty-state";

  const art = document.createElement("div");
  art.className = "empty-art";
  art.innerHTML = ICONS.clipboard;

  const title = document.createElement("h2");
  const description = document.createElement("p");
  const actions = document.createElement("div");
  actions.className = "empty-actions";

  if (currentFilter === "done") {
    title.textContent = "还没有已完成的事项";
    description.textContent = "完成一条待办后，它会出现在这里。";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-soft button-compact";
    button.dataset.action = "show-open";
    button.textContent = "查看待办";
    actions.append(button);
  } else if (currentFilter === "open" && appState.todos.length > 0) {
    title.textContent = "暂时没有待办";
    description.textContent =
      "所有待办都已完成。新建一条，或到“全部”里查看完成记录。";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-primary button-compact";
    button.dataset.action = "new-todo";
    button.textContent = "新建待办";
    actions.append(button);
  } else {
    title.textContent =
      currentFilter === "open" ? "从一条待办开始" : "这里还很空";
    description.textContent =
      "添加单条待办，或创建一个分组来批量整理任务。";

    const createButton = document.createElement("button");
    createButton.type = "button";
    createButton.className = "button button-primary button-compact";
    createButton.dataset.action = "new-todo";
    createButton.textContent = "新建待办";

    const groupButton = document.createElement("button");
    groupButton.type = "button";
    groupButton.className = "button button-soft button-compact";
    groupButton.dataset.action = "new-group";
    groupButton.textContent = "创建分组";

    actions.append(createButton, groupButton);
  }

  wrapper.append(art, title, description, actions);
  return wrapper;
}

function handleTaskAreaClick(event) {
  const trigger = event.target.closest("[data-action]");
  if (!trigger || !refs.taskArea.contains(trigger)) return;

  const action = trigger.dataset.action;
  const todoId = trigger.dataset.id;
  const groupId = trigger.dataset.groupId;

  if (action === "toggle-todo" && todoId) {
    void toggleTodo(todoId);
  } else if (action === "edit-todo" && todoId) {
    const todo = getTodo(todoId);
    if (todo) openTodoDialog(todo);
  } else if (action === "add-to-group" && groupId) {
    openTodoDialog(null, groupId);
  } else if (action === "edit-group" && groupId) {
    openGroupEditDialog(groupId);
  } else if (action === "new-todo") {
    openTodoDialog();
  } else if (action === "new-group") {
    openGroupDialog();
  } else if (action === "show-open") {
    setFilter("open");
  }
}

async function toggleTodo(todoId) {
  const todo = getTodo(todoId);
  if (!todo) return;

  const previousCompleted = todo.completed;
  const previousCompletedAt = todo.completedAt;

  todo.completed = !todo.completed;
  todo.completedAt = todo.completed ? Date.now() : null;
  todo.updatedAt = Date.now();

  try {
    await persistState();
    render();
    if (todo.completed) showToast("已完成");
  } catch {
    todo.completed = previousCompleted;
    todo.completedAt = previousCompletedAt;
    render();
  }
}

function openTodoDialog(todo = null, presetGroupId = null) {
  refs.todoForm.reset();
  clearError(refs.todoError);
  populateGroupSelect(todo?.groupId || presetGroupId || "");

  refs.todoDialogTitle.textContent = todo ? "编辑待办" : "新建待办";
  refs.todoId.value = todo?.id || "";
  refs.todoName.value = todo?.name || "";
  refs.todoNote.value = todo?.note || "";
  setDateTimeField(refs.todoDue, todo?.dueAt);
  setDateTimeField(refs.todoReminder, todo?.reminderAt);

  const priority = PRIORITY_META[todo?.priority]
    ? todo.priority
    : "none";
  const priorityInput = refs.todoForm.querySelector(
    `input[name="todoPriority"][value="${priority}"]`
  );
  if (priorityInput) priorityInput.checked = true;

  refs.deleteTodoButton.hidden = !todo;

  refs.todoDialog.showModal();
  window.setTimeout(() => refs.todoName.focus(), 40);
}

function populateGroupSelect(selectedId) {
  const options = [new Option("不分组", "")];

  for (const group of appState.groups) {
    options.push(new Option(group.name, group.id));
  }

  refs.todoGroup.replaceChildren(...options);
  refs.todoGroup.disabled = appState.groups.length === 0;

  const canSelect =
    selectedId && appState.groups.some((group) => group.id === selectedId);
  refs.todoGroup.value = canSelect ? selectedId : "";
}

async function saveTodoFromForm() {
  const form = refs.todoForm;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;

  const name = refs.todoName.value.trim();
  if (!name) {
    showError(refs.todoError, "请填写待办名称。");
    refs.todoName.focus();
    return;
  }

  const dueAt = getDateTimeFieldValue(refs.todoDue);
  const reminderAt = getDateTimeFieldValue(refs.todoReminder);
  const priorityValue = form.querySelector(
    'input[name="todoPriority"]:checked'
  )?.value;
  const priority = PRIORITY_META[priorityValue] ? priorityValue : "none";
  const groupId =
    refs.todoGroup.value &&
    appState.groups.some((group) => group.id === refs.todoGroup.value)
      ? refs.todoGroup.value
      : null;
  const editingId = refs.todoId.value;
  const now = Date.now();
  let previousTodo = null;
  let addedTodo = null;

  setFormBusy(form, true);

  try {
    if (editingId) {
      const todo = getTodo(editingId);
      if (!todo) {
        showError(refs.todoError, "这条待办已不存在，请关闭后重试。");
        return;
      }

      previousTodo = { ...todo };

      if (todo.reminderAt !== reminderAt) {
        todo.reminderNotifiedAt = null;
      }

      Object.assign(todo, {
        name,
        note: refs.todoNote.value.trim(),
        priority,
        dueAt,
        reminderAt,
        groupId,
        updatedAt: now
      });
    } else {
      addedTodo = {
        id: generateId(),
        name,
        note: refs.todoNote.value.trim(),
        priority,
        dueAt,
        reminderAt,
        reminderNotifiedAt: null,
        completed: false,
        completedAt: null,
        groupId,
        createdAt: now,
        updatedAt: now
      };
      appState.todos.push(addedTodo);
    }

    await persistState();
    refs.todoDialog.close();

    if (!editingId && currentFilter === "done") {
      currentFilter = "open";
      applyFilterUI();
    }

    render();
    showToast(editingId ? "待办已更新" : "待办已创建");
  } catch {
    // persistState 已提示错误，撤销内存修改并保留弹窗以便重试。
    if (addedTodo) {
      appState.todos = appState.todos.filter(
        (item) => item.id !== addedTodo.id
      );
    }

    if (previousTodo) {
      const todo = getTodo(editingId);
      if (todo) Object.assign(todo, previousTodo);
    }

    render();
  } finally {
    setFormBusy(form, false);
  }
}

async function deleteCurrentTodo() {
  const todo = getTodo(refs.todoId.value);
  if (!todo) return;

  const confirmed = await confirmAction({
    title: "删除这条待办？",
    message: `「${todo.name}」及其提醒设置将被删除，此操作无法撤销。`,
    confirmText: "删除"
  });

  if (!confirmed) return;

  appState.todos = appState.todos.filter((item) => item.id !== todo.id);
  refs.todoDialog.close();

  try {
    await persistState();
    render();
    showToast("待办已删除");
  } catch {
    // 保存失败时重新读取，避免界面显示未持久化的删除结果。
    await loadState();
    render();
  }
}

function openGroupDialog() {
  refs.groupForm.reset();
  clearError(refs.groupError);
  refs.groupRows.replaceChildren();
  groupRowSequence = 0;
  addGroupTaskRow();

  refs.groupDialog.showModal();
  window.setTimeout(() => refs.groupName.focus(), 40);
}

function addGroupTaskRow(initial = {}, shouldFocus = false) {
  const fragment = refs.groupTaskTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".group-task-row");
  const rowKey = `group-row-${++groupRowSequence}`;

  row.dataset.rowKey = rowKey;

  for (const radio of row.querySelectorAll("[data-priority-radio]")) {
    radio.name = `group-priority-${rowKey}`;
    if (radio.value === (initial.priority || "none")) {
      radio.checked = true;
    }
  }

  row.querySelector('[data-field="name"]').value = initial.name || "";
  row.querySelector('[data-field="note"]').value = initial.note || "";
  setDateTimeField(row.querySelector('[data-field="dueAt"]'), initial.dueAt);
  setDateTimeField(
    row.querySelector('[data-field="reminderAt"]'),
    initial.reminderAt
  );

  refs.groupRows.append(fragment);
  updateGroupRowMeta();

  if (shouldFocus) {
    const input = refs.groupRows.lastElementChild?.querySelector(
      '[data-field="name"]'
    );
    input?.focus();
    input?.scrollIntoView({ block: "nearest" });
  }
}

function handleGroupRowClick(event) {
  const button = event.target.closest(
    '[data-action="remove-group-row"]'
  );
  if (!button) return;

  const rows = refs.groupRows.querySelectorAll(".group-task-row");
  if (rows.length <= 1) return;

  button.closest(".group-task-row")?.remove();
  updateGroupRowMeta();
}

function updateGroupRowMeta() {
  const rows = Array.from(refs.groupRows.querySelectorAll(".group-task-row"));
  refs.groupTaskCount.textContent = `${rows.length} 条`;

  rows.forEach((row, index) => {
    const label = row.querySelector(".row-number");
    if (label) label.textContent = `待办 ${index + 1}`;

    const removeButton = row.querySelector(
      '[data-action="remove-group-row"]'
    );
    if (removeButton) removeButton.disabled = rows.length === 1;
  });
}

async function saveGroupFromForm() {
  const form = refs.groupForm;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;

  const groupName = refs.groupName.value.trim();
  if (!groupName) {
    showError(refs.groupError, "请填写分组名称。");
    refs.groupName.focus();
    return;
  }

  const rows = Array.from(refs.groupRows.querySelectorAll(".group-task-row"));
  const drafts = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const nameInput = row.querySelector('[data-field="name"]');
    const noteInput = row.querySelector('[data-field="note"]');
    const dueField = row.querySelector('[data-field="dueAt"]');
    const reminderField = row.querySelector('[data-field="reminderAt"]');
    const priorityInput = row.querySelector(
      "[data-priority-radio]:checked"
    );

    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    const priority = PRIORITY_META[priorityInput?.value]
      ? priorityInput.value
      : "none";
    const dueAt = getDateTimeFieldValue(dueField);
    const reminderAt = getDateTimeFieldValue(reminderField);
    const hasContent =
      Boolean(name) ||
      Boolean(note) ||
      dueAt !== null ||
      reminderAt !== null ||
      priority !== "none";

    if (!hasContent) continue;

    if (!name) {
      showError(
        refs.groupError,
        `第 ${index + 1} 条待办还没有填写名称。`
      );
      nameInput.focus();
      return;
    }

    drafts.push({
      name,
      note,
      priority,
      dueAt,
      reminderAt
    });
  }

  if (drafts.length === 0) {
    showError(refs.groupError, "请至少填写一条待办。");
    refs.groupRows
      .querySelector('[data-field="name"]')
      ?.focus();
    return;
  }

  const now = Date.now();
  const groupId = generateId();
  const group = {
    id: groupId,
    name: groupName,
    createdAt: now
  };

  const todos = drafts.map((draft, index) => ({
    id: generateId(),
    name: draft.name,
    note: draft.note,
    priority: draft.priority,
    dueAt: draft.dueAt,
    reminderAt: draft.reminderAt,
    reminderNotifiedAt: null,
    completed: false,
    completedAt: null,
    groupId,
    createdAt: now + index,
    updatedAt: now
  }));

  appState.groups.push(group);
  appState.todos.push(...todos);

  setFormBusy(form, true);

  try {
    await persistState();
    refs.groupDialog.close();

    if (currentFilter === "done") {
      currentFilter = "open";
      applyFilterUI();
    }

    render();
    showToast(`已创建分组，共 ${todos.length} 条待办`);
  } catch {
    appState.groups = appState.groups.filter((item) => item.id !== groupId);
    appState.todos = appState.todos.filter((item) => item.groupId !== groupId);
  } finally {
    setFormBusy(form, false);
  }
}

function openGroupEditDialog(groupId) {
  const group = getGroup(groupId);
  if (!group) {
    showToast("该分组已不存在");
    return;
  }

  refs.groupEditForm.reset();
  clearError(refs.groupEditError);
  refs.editGroupId.value = group.id;
  refs.editGroupName.value = group.name;

  const count = appState.todos.filter(
    (todo) => todo.groupId === group.id
  ).length;
  refs.deleteGroupButton.textContent = count
    ? `删除分组（${count}）`
    : "删除分组";

  refs.groupEditDialog.showModal();
  window.setTimeout(() => {
    refs.editGroupName.focus();
    refs.editGroupName.select();
  }, 40);
}

async function saveGroupEdit() {
  const form = refs.groupEditForm;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton.disabled) return;

  const group = getGroup(refs.editGroupId.value);
  if (!group) {
    showError(refs.groupEditError, "该分组已不存在。");
    return;
  }

  const name = refs.editGroupName.value.trim();
  if (!name) {
    showError(refs.groupEditError, "请填写分组名称。");
    refs.editGroupName.focus();
    return;
  }

  const previousName = group.name;
  group.name = name.slice(0, 80);
  setFormBusy(form, true);

  try {
    await persistState();
    refs.groupEditDialog.close();
    render();
    showToast("分组名称已更新");
  } catch {
    group.name = previousName;
    render();
  } finally {
    setFormBusy(form, false);
  }
}

async function deleteCurrentGroup() {
  const group = getGroup(refs.editGroupId.value);
  if (!group) return;

  const count = appState.todos.filter(
    (todo) => todo.groupId === group.id
  ).length;
  const confirmed = await confirmAction({
    title: "删除这个分组？",
    message: count
      ? `「${group.name}」及其中 ${count} 条待办将被一并删除，此操作无法撤销。`
      : `「${group.name}」将被删除，此操作无法撤销。`,
    confirmText: "删除分组"
  });

  if (!confirmed) return;

  appState.groups = appState.groups.filter((item) => item.id !== group.id);
  appState.todos = appState.todos.filter(
    (todo) => todo.groupId !== group.id
  );
  refs.groupEditDialog.close();

  try {
    await persistState();
    render();
    showToast("分组已删除");
  } catch {
    await loadState();
    render();
  }
}

function confirmAction({ title, message, confirmText = "删除" }) {
  refs.confirmTitle.textContent = title;
  refs.confirmMessage.textContent = message;
  refs.confirmAccept.textContent = confirmText;
  refs.confirmDialog.returnValue = "";

  return new Promise((resolve) => {
    const handleClose = () => {
      resolve(refs.confirmDialog.returnValue === "confirm");
    };

    refs.confirmDialog.addEventListener("close", handleClose, { once: true });
    refs.confirmDialog.showModal();
  });
}

function handleDateTimeTriggerClick(event) {
  const trigger = event.target.closest("[data-datetime-field]");
  if (!trigger) return;

  event.preventDefault();
  openDateTimePicker(trigger);
}

function getDateTimeFieldValue(field) {
  const raw = field?.dataset.timestamp;
  if (!raw) return null;

  const timestamp = Number(raw);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function setDateTimeField(field, timestamp) {
  if (!field) return;

  const valueElement = field.querySelector(".datetime-value");
  const fieldName = field.dataset.fieldName || "时间";

  if (Number.isFinite(timestamp)) {
    field.dataset.timestamp = String(timestamp);

    if (valueElement) {
      valueElement.textContent = formatDateTime(timestamp);
      valueElement.classList.remove("is-empty");
    }

    field.title = formatFullDateTime(timestamp);
    field.setAttribute(
      "aria-label",
      `${fieldName}：${formatFullDateTime(timestamp)}，点击修改`
    );
  } else {
    delete field.dataset.timestamp;

    if (valueElement) {
      valueElement.textContent = "未设置";
      valueElement.classList.add("is-empty");
    }

    field.removeAttribute("title");
    field.setAttribute("aria-label", `选择${fieldName}`);
  }
}

function openDateTimePicker(field) {
  const existingValue = getDateTimeFieldValue(field);
  const baseDate =
    existingValue !== null ? new Date(existingValue) : new Date();

  calendarSelection = {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth(),
    day: baseDate.getDate(),
    hour: baseDate.getHours(),
    minute: baseDate.getMinutes()
  };
  calendarView = {
    year: calendarSelection.year,
    month: calendarSelection.month
  };
  datetimePickerTarget = field;

  refs.datePickerTitle.textContent =
    field.dataset.pickerLabel || "选择时间";
  refs.clearDateTimeButton.hidden = existingValue === null;
  refs.datetimeHour.value = String(calendarSelection.hour);
  refs.datetimeMinute.value = pad2(calendarSelection.minute);
  clearError(refs.datetimeError);
  renderCalendar();
  updateDateTimeSelectionLabel();

  refs.datePickerDialog.showModal();
  window.setTimeout(() => focusSelectedCalendarDay(), 40);
}

function renderCalendar() {
  refs.calendarMonthLabel.textContent = `${
    calendarView.year
  }年${calendarView.month + 1}月`;

  const firstOfMonth = new Date(calendarView.year, calendarView.month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(
    calendarView.year,
    calendarView.month,
    1 - mondayOffset
  );
  const todayKey = dateToKey(new Date());
  const selectedKey = dateToKey(calendarSelection);
  const fragment = document.createDocumentFragment();
  let selectedIsVisible = false;

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const key = dateToKey(date);
    const button = document.createElement("button");

    button.type = "button";
    button.className = "calendar-day";
    button.dataset.date = key;
    button.textContent = String(date.getDate());
    button.tabIndex = -1;
    button.setAttribute("aria-pressed", "false");
    button.setAttribute(
      "aria-label",
      `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日${
        key === todayKey ? "，今天" : ""
      }`
    );

    if (date.getMonth() !== calendarView.month) {
      button.classList.add("is-outside");
    }

    if (key === todayKey) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }

    if (key === selectedKey) {
      button.classList.add("is-selected");
      button.tabIndex = 0;
      button.setAttribute("aria-pressed", "true");
      selectedIsVisible = true;
    }

    fragment.append(button);
  }

  refs.calendarGrid.replaceChildren(fragment);

  if (!selectedIsVisible) {
    const firstInView = Array.from(refs.calendarGrid.children).find(
      (button) => !button.classList.contains("is-outside")
    );
    if (firstInView) firstInView.tabIndex = 0;
  }
}

function handleCalendarGridClick(event) {
  const dayButton = event.target.closest("[data-date]");
  if (!dayButton || !refs.calendarGrid.contains(dayButton)) return;

  const date = parseDateKey(dayButton.dataset.date);
  if (!date) return;

  selectCalendarDate(date);
}

function handleCalendarKeydown(event) {
  if (event.key === "Home") {
    event.preventDefault();
    selectToday();
    return;
  }

  const movements = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7
  };
  const offset = movements[event.key];

  if (!offset) return;

  event.preventDefault();
  const nextDate = new Date(
    calendarSelection.year,
    calendarSelection.month,
    calendarSelection.day + offset
  );
  selectCalendarDate(nextDate);
}

function selectCalendarDate(date) {
  calendarSelection.year = date.getFullYear();
  calendarSelection.month = date.getMonth();
  calendarSelection.day = date.getDate();
  calendarView = {
    year: calendarSelection.year,
    month: calendarSelection.month
  };

  renderCalendar();
  updateDateTimeSelectionLabel();
  focusSelectedCalendarDay();
}

function shiftCalendarMonth(offset) {
  const nextMonth = new Date(
    calendarView.year,
    calendarView.month + offset,
    1
  );

  calendarView = {
    year: nextMonth.getFullYear(),
    month: nextMonth.getMonth()
  };
  renderCalendar();
}

function selectToday() {
  const today = new Date();

  calendarSelection.year = today.getFullYear();
  calendarSelection.month = today.getMonth();
  calendarSelection.day = today.getDate();
  calendarView = {
    year: calendarSelection.year,
    month: calendarSelection.month
  };

  renderCalendar();
  updateDateTimeSelectionLabel();
  focusSelectedCalendarDay();
}

function focusSelectedCalendarDay() {
  refs.calendarGrid.querySelector(".is-selected")?.focus();
}

function updateDateTimeSelectionLabel() {
  clearError(refs.datetimeError);

  const hourRaw = refs.datetimeHour.value.trim();
  const minuteRaw = refs.datetimeMinute.value.trim();
  const dateText = `${calendarSelection.year}年${
    calendarSelection.month + 1
  }月${calendarSelection.day}日`;

  if (isValidHour(hourRaw) && isValidMinute(minuteRaw)) {
    refs.datetimeSelectionLabel.textContent = `已选择：${dateText} ${pad2(
      Number(hourRaw)
    )}:${pad2(Number(minuteRaw))}`;
  } else {
    refs.datetimeSelectionLabel.textContent = `日期：${dateText} · 请填写有效的时间`;
  }
}

function confirmDateTimePicker() {
  if (!datetimePickerTarget) return;

  const hourRaw = refs.datetimeHour.value.trim();
  const minuteRaw = refs.datetimeMinute.value.trim();

  if (!isValidHour(hourRaw)) {
    showError(refs.datetimeError, "请输入 0 到 23 之间的小时。");
    refs.datetimeHour.focus();
    return;
  }

  if (!isValidMinute(minuteRaw)) {
    showError(refs.datetimeError, "请输入 0 到 59 之间的分钟。");
    refs.datetimeMinute.focus();
    return;
  }

  const timestamp = new Date(
    calendarSelection.year,
    calendarSelection.month,
    calendarSelection.day,
    Number(hourRaw),
    Number(minuteRaw),
    0,
    0
  ).getTime();

  if (!Number.isFinite(timestamp)) {
    showError(refs.datetimeError, "日期时间无效，请重新选择。");
    return;
  }

  const target = datetimePickerTarget;
  setDateTimeField(target, timestamp);
  refs.datePickerDialog.close();
  target.focus();
}

function clearDateTimePicker() {
  if (!datetimePickerTarget) return;

  const target = datetimePickerTarget;
  setDateTimeField(target, null);
  refs.datePickerDialog.close();
  target.focus();
}

function isValidHour(value) {
  if (!/^\d{1,2}$/.test(value)) return false;
  const hour = Number(value);
  return hour >= 0 && hour <= 23;
}

function isValidMinute(value) {
  if (!/^\d{1,2}$/.test(value)) return false;
  const minute = Number(value);
  return minute >= 0 && minute <= 59;
}

function dateToKey(date) {
  const year = date instanceof Date ? date.getFullYear() : date.year;
  const month = date instanceof Date ? date.getMonth() : date.month;
  const day = date instanceof Date ? date.getDate() : date.day;

  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

function parseDateKey(key) {
  if (typeof key !== "string") return null;

  const parts = key.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const datePart =
    date.getFullYear() === now.getFullYear()
      ? `${date.getMonth() + 1}月${date.getDate()}日`
      : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;

  return `${datePart} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatFullDateTime(timestamp) {
  if (!Number.isFinite(timestamp)) return "";

  const date = new Date(timestamp);

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function getTodo(todoId) {
  return appState.todos.find((todo) => todo.id === todoId) || null;
}

function getGroup(groupId) {
  return appState.groups.find((group) => group.id === groupId) || null;
}

function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function showError(element, message) {
  element.textContent = message;
  element.hidden = false;
}

function clearError(element) {
  element.textContent = "";
  element.hidden = true;
}

function setFormBusy(form, busy) {
  form.setAttribute("aria-busy", String(busy));

  for (const button of form.querySelectorAll(
    'button[type="submit"], #deleteTodoButton, #deleteGroupButton'
  )) {
    button.disabled = busy;
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastHideTimer);

  refs.toast.textContent = message;
  refs.toast.hidden = false;
  refs.toast.classList.remove("is-visible");

  window.requestAnimationFrame(() => {
    refs.toast.classList.add("is-visible");
  });

  toastTimer = window.setTimeout(() => {
    refs.toast.classList.remove("is-visible");
    toastHideTimer = window.setTimeout(() => {
      refs.toast.hidden = true;
    }, 190);
  }, 2200);
}
