// Initialize this browser view from the PostgreSQL-backed state sent by Flask.
// Local storage remains a small UI cache; every save is sent to the server.
(function bootstrapTlmsState() {
  const state = window.TLMS_INITIAL_STATE;
  if (!state) return;

  const mapping = {
    teams: 'ts_teams',
    employees: 'ts_employees',
    tasks: 'ts_tasks',
    links: 'ts_links',
    link_categories: 'ts_link_categories'
  };

  Object.entries(mapping).forEach(([key, storageKey]) => {
    if (Array.isArray(state[key])) {
      localStorage.setItem(storageKey, JSON.stringify(state[key]));
    }
  });
})();

function syncTlmsState() {
  const payload = {
    teams: JSON.parse(localStorage.getItem('ts_teams') || '[]'),
    employees: JSON.parse(localStorage.getItem('ts_employees') || '[]'),
    tasks: JSON.parse(localStorage.getItem('ts_tasks') || '[]'),
    links: JSON.parse(localStorage.getItem('ts_links') || '[]'),
    link_categories: JSON.parse(
      localStorage.getItem('ts_link_categories') || '[]'
    )
  };

  fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        console.error('TLMS save failed:', response.status);
      }
      return response.json();
    })
    .catch(error => {
      console.error('Could not sync TLMS data with server:', error);
    });
}

/* =====================================================
   TeamSync – data.js
   Shared localStorage layer used by all pages
   ===================================================== */

const Storage = {
  /* ---- Admin Credentials ---- */
  getAdminCreds() {
    try {
      return JSON.parse(
        localStorage.getItem('ts_admin') ||
        '{"username":"admin","password":""}'
      );
    } catch (_) {
      return { username: 'admin', password: '' };
    }
  },

  setAdminCreds(creds) {
    localStorage.setItem('ts_admin', JSON.stringify(creds));
  },

  /* ---- Demo Data Detection & Purge ---- */
  isDemoTeam(team) {
    if (!team) return false;

    const leader = String(team.leader || '').trim().toLowerCase();
    const desc = String(team.desc || '').trim().toLowerCase();

    if (leader === 'sarah jenkins' || desc === 'frontend development team') {
      return true;
    }

    if (leader === 'david chen' || desc === 'backend engineering team') {
      return true;
    }

    if (leader === 'emily watson' || desc === 'qa & testing team') {
      return true;
    }

    return false;
  },

  isDemoLink(link) {
    if (!link) return false;

    const url = String(link.url || '').trim().toLowerCase();
    const title = String(link.title || '').trim().toLowerCase();

    const demoUrls = [
      'https://github.com/organization/tlms-frontend',
      'https://www.youtube.com/watch?v=dqw4w9wgxcq',
      'https://www.hotstar.com',
      'https://drive.google.com/drive/folders/shared-assets',
      'https://docs.google.com/document/d/shared-specs'
    ];

    if (demoUrls.some(item => url === item || url.startsWith(item))) {
      return true;
    }

    if (url === 'https://www.figma.com' && title === 'figma design workspace') {
      return true;
    }

    const demoTitles = [
      'main frontend repository',
      'architecture overview & training',
      'hotstar live streaming tech hub',
      'shared asset & design drive',
      'product requirements & api specs',
      'figma design workspace'
    ];

    return demoTitles.includes(title);
  },

  removeDemoData() {
    try {
      const storedTeams = localStorage.getItem('ts_teams');

      if (storedTeams) {
        const teams = JSON.parse(storedTeams);

        if (Array.isArray(teams)) {
          localStorage.setItem(
            'ts_teams',
            JSON.stringify(teams.filter(team => !this.isDemoTeam(team)))
          );
        }
      }

      const storedLinks = localStorage.getItem('ts_links');

      if (storedLinks) {
        const links = JSON.parse(storedLinks);

        if (Array.isArray(links)) {
          localStorage.setItem(
            'ts_links',
            JSON.stringify(links.filter(link => !this.isDemoLink(link)))
          );
        }
      }

      const storedCategories = localStorage.getItem('ts_link_categories');

      if (storedCategories) {
        const categories = JSON.parse(storedCategories);

        if (Array.isArray(categories)) {
          localStorage.setItem(
            'ts_link_categories',
            JSON.stringify(
              categories.filter(
                category =>
                  typeof category === 'string' &&
                  category.trim().toLowerCase() !== 'hotstar'
              )
            )
          );
        }
      }
    } catch (_) { }
  },

  /* ---- Teams ---- */
  getTeams() {
    const stored = localStorage.getItem('ts_teams');

    if (stored) {
      try {
        const teams = JSON.parse(stored);

        if (Array.isArray(teams)) {
          return teams.filter(team => !this.isDemoTeam(team));
        }
      } catch (_) { }
    }

    return [];
  },

  saveTeams(teams) {
    localStorage.setItem('ts_teams', JSON.stringify(teams));
    syncTlmsState();
  },

  /* ---- Employees ---- */
  getEmployees() {
    return JSON.parse(localStorage.getItem('ts_employees') || '[]');
  },

  saveEmployees(employees) {
    localStorage.setItem('ts_employees', JSON.stringify(employees));
    syncTlmsState();
  },

  /* ---- Tasks ---- */
  getTasks() {
    return JSON.parse(localStorage.getItem('ts_tasks') || '[]');
  },

  saveTasks(tasks) {
    localStorage.setItem('ts_tasks', JSON.stringify(tasks));
    syncTlmsState();
  },

  /* ---- Shared Team Links ---- */
  getLinks() {
    const stored = localStorage.getItem('ts_links');

    if (stored) {
      try {
        const links = JSON.parse(stored);

        if (Array.isArray(links)) {
          return links.filter(link => !this.isDemoLink(link));
        }
      } catch (_) { }
    }

    return [];
  },

  saveLinks(links) {
    localStorage.setItem('ts_links', JSON.stringify(links));
    syncTlmsState();
  },

  /* ---- Link Categories ---- */
  getLinkCategories() {
    const defaultCategories = [
      'GitHub',
      'YouTube',
      'Google Drive',
      'Google Docs',
      'Other'
    ];

    let categories = [];
    const stored = localStorage.getItem('ts_link_categories');

    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        if (Array.isArray(parsed) && parsed.length > 0) {
          categories = parsed.filter(
            category =>
              typeof category === 'string' &&
              category.trim().length > 0 &&
              category.trim().toLowerCase() !== 'hotstar'
          );
        }
      } catch (_) { }
    }

    if (!categories.length) {
      categories = [...defaultCategories];
    }

    try {
      this.getLinks().forEach(link => {
        if (link && typeof link.category === 'string') {
          const category = link.category.trim();

          if (
            category &&
            !categories.some(
              item => item.toLowerCase() === category.toLowerCase()
            )
          ) {
            const otherIndex = categories.findIndex(
              item => item.toLowerCase() === 'other'
            );

            if (otherIndex !== -1) {
              categories.splice(otherIndex, 0, category);
            } else {
              categories.push(category);
            }
          }
        }
      });
    } catch (_) { }

    localStorage.setItem('ts_link_categories', JSON.stringify(categories));
    return categories;
  },

  saveLinkCategories(categories) {
    if (!Array.isArray(categories)) return;

    const cleaned = categories
      .map(category => String(category).trim())
      .filter(Boolean);

    localStorage.setItem('ts_link_categories', JSON.stringify(cleaned));
    syncTlmsState();
  },

  addLinkCategory(categoryName) {
    const category = String(categoryName || '').trim();

    if (!category) {
      return { success: false, message: 'Category name cannot be empty.' };
    }

    if (category.length > 40) {
      return {
        success: false,
        message: 'Category name must be under 40 characters.'
      };
    }

    const categories = this.getLinkCategories();

   if (
  categories.some(item => item.toLowerCase() === category.toLowerCase())
) {
  return {
    success: false,
    message: `Category "${category}" already exists.`
  };
}

    const otherIndex = categories.findIndex(
      item => item.toLowerCase() === 'other'
    );

    if (otherIndex !== -1) {
      categories.splice(otherIndex, 0, category);
    } else {
      categories.push(category);
    }

    this.saveLinkCategories(categories);
    return { success: true, category };
  },

  deleteLinkCategory(categoryName) {
    const category = String(categoryName || '').trim();

    if (!category) return false;

    let categories = this.getLinkCategories();

    categories = categories.filter(
      item => item.toLowerCase() !== category.toLowerCase()
    );

    if (categories.length === 0) {
      categories = ['Other'];
    }

    this.saveLinkCategories(categories);
    return true;
  },

  /* ---- ID Counters ---- */
  nextId(key) {
    const number = parseInt(localStorage.getItem(key) || '1', 10);
    localStorage.setItem(key, String(number + 1));
    return number;
  }
};

/* ---- Dynamic Link Categories Proxy ---- */
const LINK_CATEGORIES = new Proxy([], {
  get(target, property) {
    const categories = Storage.getLinkCategories();

    if (property === 'length') return categories.length;

    if (property in categories) {
      const value = categories[property];
      return typeof value === 'function'
        ? value.bind(categories)
        : value;
    }

    if (property === Symbol.iterator) {
      return categories[Symbol.iterator].bind(categories);
    }

    return categories[property];
  }
});

function getCategoryIcon(category = '') {
  const name = String(category || '').trim().toLowerCase();

  const icons = {
    github: 'fab fa-github',
    youtube: 'fab fa-youtube',
    hotstar: 'fas fa-play-circle',
    'google drive': 'fab fa-google-drive',
    'google docs': 'fas fa-file-alt',
    'google sheets': 'fas fa-file-excel',
    figma: 'fab fa-figma',
    slack: 'fab fa-slack',
    jira: 'fab fa-jira',
    confluence: 'fab fa-confluence',
    trello: 'fab fa-trello',
    gitlab: 'fab fa-gitlab',
    bitbucket: 'fab fa-bitbucket',
    notion: 'fas fa-book',
    zoom: 'fas fa-video',
    teams: 'fab fa-microsoft',
    'microsoft teams': 'fab fa-microsoft',
    dropbox: 'fab fa-dropbox',
    aws: 'fab fa-aws',
    docker: 'fab fa-docker',
    other: 'fas fa-link'
  };

  return icons[name] || 'fas fa-folder';
}

function linkBelongsToTeam(link, teamId) {
  if (!link || teamId === undefined || teamId === null || teamId === '') {
    return false;
  }

  if (Array.isArray(link.teamIds) && link.teamIds.length > 0) {
    return link.teamIds.some(
      id => String(id) === String(teamId) || String(id) === 'all'
    );
  }

  return String(link.teamId) === String(teamId) || String(link.teamId) === 'all';
}

function getLinkTeams(link, allTeams = []) {
  if (!link || !allTeams) return [];

  const ids =
    Array.isArray(link.teamIds) && link.teamIds.length > 0
      ? link.teamIds.map(String)
      : link.teamId
        ? [String(link.teamId)]
        : [];

  return allTeams.filter(team => ids.includes(String(team.id)));
}

/* ---- Utility Helpers ---- */
function initials(name = '') {
  return (
    name
      .trim()
      .split(' ')
      .map(word => word[0] || '')
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  );
}

function formatDate(iso) {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function isOverdue(iso) {
  if (!iso) return false;

  if (typeof iso === 'string' && iso.length === 10) {
    const [year, month, day] = iso.split('-').map(Number);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    return new Date() > endOfDay;
  }

  return new Date(iso) < new Date();
}

/* ---- Live Topbar Clock ---- */
function initLiveClock(containerId = 'liveClock') {
  function tick() {
    const element = document.getElementById(containerId);
    if (!element) return;

    const now = new Date();

    const dateString = now.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    const timeString = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    const textElement = element.querySelector('.clock-time') || element;
    textElement.textContent = `${dateString} • ${timeString}`;
  }

  tick();
  setInterval(tick, 1000);
}

function statusLabel(status) {
  return {
    pending: 'Pending',
    todo: 'Pending',
    inprogress: 'In Progress',
    completed: 'Completed',
    done: 'Completed',
    review: 'In Review'
  }[status] || status;
}

function statusClass(status) {
  return {
    pending: 's-pending',
    todo: 's-pending',
    inprogress: 's-inprogress',
    completed: 's-completed',
    done: 's-completed',
    review: 's-review'
  }[status] || '';
}

function priorityClass(priority) {
  return {
    high: 'p-high',
    medium: 'p-medium',
    low: 'p-low'
  }[priority] || '';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));
}

/* ---- Multi-team Assignment Helpers ---- */
function taskBelongsToTeam(task, teamId) {
  if (!task || teamId === undefined || teamId === null || teamId === '') {
    return false;
  }

  if (Array.isArray(task.teamIds) && task.teamIds.length > 0) {
    return task.teamIds.some(id => String(id) === String(teamId));
  }

  return String(task.teamId) === String(teamId);
}

function getTaskTeams(task, allTeams = []) {
  if (!task || !allTeams) return [];

  const ids =
    Array.isArray(task.teamIds) && task.teamIds.length > 0
      ? task.teamIds.map(String)
      : task.teamId
        ? [String(task.teamId)]
        : [];

  return allTeams.filter(team => ids.includes(String(team.id)));
}

function getTaskAssignedTeam(task, allTeams = [], allEmployees = []) {
  if (!task || !allTeams || !allTeams.length) return null;

  // 1. If assigned to an employee who belongs to a team, use that employee's team
  if (task.empId && allEmployees && allEmployees.length) {
    const employee = allEmployees.find(
      item => String(item.id) === String(task.empId)
    );

    if (employee && employee.teamId) {
      const employeeTeam = allTeams.find(
        team => String(team.id) === String(employee.teamId)
      );

      if (employeeTeam) return employeeTeam;
    }
  }

  // 2. Specific team assigned to the task
  if (task.teamId) {
    const team = allTeams.find(
      item => String(item.id) === String(task.teamId)
    );

    if (team) return team;
  }

  // 3. First team in teamIds array if present
  if (Array.isArray(task.teamIds) && task.teamIds.length > 0) {
    const team = allTeams.find(
      item => String(item.id) === String(task.teamIds[0])
    );

    if (team) return team;
  }

  // 4. Fallback to first team from getTaskTeams
  const teams = getTaskTeams(task, allTeams);
  return teams.length > 0 ? teams[0] : null;
}

/* ---- Universal Form Validation ---- */
function validateFormFields(container) {
  if (!container) return true;

  let hasError = false;
  let firstInvalidElement = null;

  const fields = container.querySelectorAll('.field');

  fields.forEach(field => {
    const requiredMarker = field.querySelector('.req');

    const markerVisible =
      requiredMarker &&
      window.getComputedStyle(requiredMarker).display !== 'none';

    const input = field.querySelector(
      'input:not([type="hidden"]), select, textarea'
    );

    if (!input) return;

    const required =
      markerVisible ||
      input.hasAttribute('required') ||
      input.dataset.required === 'true';

    if (!required) return;

    const value = input.value ? input.value.trim() : '';

    if (!value) {
      hasError = true;
      markFieldInvalid(field, input, 'Please fill this field.');

      if (!firstInvalidElement) {
        firstInvalidElement = input;
      }
    } else {
      markFieldValid(field, input);
    }
  });

  if (hasError) {
    toast('Please fill this field.', 'danger');

    if (firstInvalidElement) {
      firstInvalidElement.focus();
    }

    return false;
  }

  return true;
}

function markFieldInvalid(
  fieldElement,
  inputElement,
  message = 'Please fill this field.'
) {
  inputElement.classList.add('inp-error');

  let errorElement = fieldElement.querySelector('.field-error-msg');

  if (!errorElement) {
    errorElement = document.createElement('div');
    errorElement.className = 'field-error-msg';
    fieldElement.appendChild(errorElement);
  }

  errorElement.innerHTML =
    `<i class="fas fa-exclamation-circle"></i> ${message}`;

  errorElement.style.display = 'flex';
}

function markFieldValid(fieldElement, inputElement) {
  inputElement.classList.remove('inp-error');

  const errorElement = fieldElement.querySelector('.field-error-msg');

  if (errorElement) {
    errorElement.remove();
  }
}

function showFieldError(inputId, message = 'Please fill this field.') {
  const input = document.getElementById(inputId);
  if (!input) return;

  const field = input.closest('.field') || input.parentElement;

  if (field) {
    markFieldInvalid(field, input, message);
  }
}

function clearFormErrors(containerId) {
  const container =
    typeof containerId === 'string'
      ? document.getElementById(containerId)
      : containerId;

  if (!container) return;

  container.querySelectorAll('.inp-error').forEach(element => {
    element.classList.remove('inp-error');
  });

  container.querySelectorAll('.field-error-msg').forEach(element => {
    element.remove();
  });
}

/* Global listener to clear field error on input / change */
document.addEventListener('input', event => {
  const target = event.target;

  if (
    target &&
    target.classList &&
    target.classList.contains('inp-error') &&
    target.value.trim()
  ) {
    const field = target.closest('.field') || target.parentElement;

    if (field) {
      markFieldValid(field, target);
    }
  }
});

document.addEventListener('change', event => {
  const target = event.target;

  if (
    target &&
    target.classList &&
    target.classList.contains('inp-error') &&
    target.value.trim()
  ) {
    const field = target.closest('.field') || target.parentElement;

    if (field) {
      markFieldValid(field, target);
    }
  }
});

/* ---- Toast ---- */
function toast(message, type = 'success') {
  const icons = {
    success: 'fa-check-circle',
    danger: 'fa-times-circle',
    warning: 'fa-exclamation-circle'
  };

  const element = document.createElement('div');
  element.className = `toast t-${type}`;
  element.innerHTML =
    `<i class="fas ${icons[type] || icons.success}"></i><span>${message}</span>`;

  let box = document.getElementById('toastBox');

  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }

  box.appendChild(element);
  setTimeout(() => element.remove(), 3500);
}

/* ---- Auth Guard ---- */
function requireAuth(role) {
  const loggedInRole = sessionStorage.getItem('loggedIn');

  if (loggedInRole !== role) {
    window.location.href = '/';
  }
}

/* ---- Logout ---- */
async function logout() {
  try {
    await fetch('/api/logout', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  } finally {
    sessionStorage.clear();
    window.location.replace('/');
  }
}

/* Auto-purge demo details on initialization */
try {
  Storage.removeDemoData();
} catch (_) { }