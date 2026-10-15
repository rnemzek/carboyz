import { h } from './App.js';
import { renderSpreadConfigView } from './SpreadConfigView.js';

const PIN_LENGTH = 4;

function renderPinChallenge({ onSubmit }) {
  const inputs = Array.from({ length: PIN_LENGTH }, (_, index) =>
    h('input', {
      type: 'tel',
      inputmode: 'numeric',
      pattern: '[0-9]*',
      maxlength: '1',
      class: 'pin-challenge__digit',
      'aria-label': `PIN digit ${index + 1}`,
    }),
  );
  const errorEl = h('p', { class: 'pin-challenge__error', role: 'alert' });

  function currentValue() {
    return inputs.map((input) => input.value).join('');
  }

  function reset() {
    inputs.forEach((input) => {
      input.value = '';
    });
    inputs[0].focus();
  }

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      errorEl.textContent = '';
      if (input.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
      if (currentValue().length === PIN_LENGTH) {
        const success = onSubmit(currentValue());
        if (!success) {
          errorEl.textContent = 'Incorrect PIN. Try again.';
          reset();
        }
      }
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });

  const section = h('div', { class: 'pin-challenge' }, [
    h('h3', { text: 'Admin Access' }),
    h('p', { text: 'Enter the 4-digit Manager PIN to continue.' }),
    h('div', { class: 'pin-challenge__digits' }, inputs),
    errorEl,
  ]);

  return { section, reset };
}

function renderTeamRosterSection(controller) {
  const nameInput = h('input', { name: 'name', placeholder: 'Name', required: '' });
  const phoneInput = h('input', { name: 'phone', placeholder: 'Phone (10-digit or E.164)', required: '' });
  const roleSelect = h('select', { name: 'role' }, [
    h('option', { value: 'MANAGER', text: 'Manager' }),
    h('option', { value: 'SALES_REP', text: 'Sales Rep' }),
  ]);
  const notifyInput = h('input', { type: 'checkbox', name: 'notifyOnPending' });
  notifyInput.checked = true;
  const statusEl = h('p', { class: 'form__status', role: 'status', 'aria-live': 'polite' });
  const list = h('div', { class: 'card-list' });

  const form = h('form', { class: 'form' }, [
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Name' }), nameInput]),
      h('div', {}, [h('label', { text: 'Phone' }), phoneInput]),
    ]),
    h('div', { class: 'form__row form__row--split' }, [
      h('div', {}, [h('label', { text: 'Role' }), roleSelect]),
      h('div', { class: 'form__row--checkbox' }, [h('label', { text: 'Notify on Pending' }), notifyInput]),
    ]),
    h('button', { class: 'button', type: 'submit', text: 'Add Team Member' }),
    statusEl,
  ]);

  function renderList() {
    list.replaceChildren();
    const members = controller.listTeamMembers();
    if (members.length === 0) {
      list.appendChild(h('p', { class: 'empty-state', text: 'No team members yet.' }));
      return;
    }
    members.forEach((member) => {
      const removeBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Remove' });
      removeBtn.addEventListener('click', () => {
        controller.removeTeamMember(member.id);
        renderList();
      });
      list.appendChild(
        h('article', { class: 'card' }, [
          h('div', { class: 'card__top' }, [h('h3', { class: 'card__title', text: member.name })]),
          h('div', { class: 'card__meta' }, [
            h('span', { text: member.phone }),
            h('span', { text: member.role }),
            h('span', { text: member.notifyOnPending ? 'Notifies on pending' : 'Notifications off' }),
          ]),
          h('div', { class: 'card__actions' }, [removeBtn]),
        ]),
      );
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      controller.addTeamMember({
        name: data.get('name'),
        phone: data.get('phone'),
        role: data.get('role'),
        notifyOnPending: notifyInput.checked,
      });
      form.reset();
      notifyInput.checked = true;
      statusEl.textContent = '';
      statusEl.classList.remove('form__status--error');
      renderList();
    } catch (error) {
      statusEl.textContent = error.message;
      statusEl.classList.add('form__status--error');
    }
  });

  renderList();

  return h('div', { class: 'team-roster' }, [h('h3', { text: 'Dealership Team & Notifications' }), form, list]);
}

export function renderAdminView(adminController, spreadConfigController) {
  const section = h('section', { class: 'view', id: 'view-admin' });

  function renderLocked() {
    section.replaceChildren();
    const { section: pinSection } = renderPinChallenge({
      onSubmit: (pin) => {
        const success = adminController.attemptUnlock(pin);
        if (success) {
          renderUnlocked();
        }
        return success;
      },
    });
    section.appendChild(h('h2', { text: 'Admin' }));
    section.appendChild(pinSection);
  }

  function renderUnlocked() {
    section.replaceChildren();
    const lockBtn = h('button', { class: 'button button--secondary', type: 'button', text: 'Lock Admin' });
    lockBtn.addEventListener('click', () => {
      adminController.lock();
      renderLocked();
    });

    const pricingSection = renderSpreadConfigView(spreadConfigController);
    pricingSection.removeAttribute('id');
    const pricingHeading = pricingSection.querySelector('h2');
    if (pricingHeading) {
      pricingHeading.textContent = 'Pricing Tiers';
    }

    section.appendChild(h('div', { class: 'view__header-row' }, [h('h2', { text: 'Admin' }), lockBtn]));
    section.appendChild(renderTeamRosterSection(adminController));
    section.appendChild(pricingSection);
  }

  if (adminController.isUnlocked()) {
    renderUnlocked();
  } else {
    renderLocked();
  }

  return { section };
}
