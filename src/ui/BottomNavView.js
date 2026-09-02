export const BOTTOM_NAV_ITEMS = [
  { tab: 'sell', label: 'Intake' },
  { tab: 'leads', label: 'Lead Inbox' },
  { tab: 'analytics', label: 'Analytics' },
  { tab: 'simulation', label: 'Simulation' },
  { tab: 'admin', label: 'Admin' },
];

export function renderBottomNavView(activeTab, onSelect) {
  const buttons = new Map();
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('role', 'tablist');

  BOTTOM_NAV_ITEMS.forEach(({ tab, label }) => {
    const button = document.createElement('button');
    button.className = 'bottom-nav__button';
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(activeTab === tab));
    button.textContent = label;
    button.addEventListener('click', () => onSelect(tab));
    buttons.set(tab, button);
    nav.appendChild(button);
  });

  return { nav, buttons };
}
