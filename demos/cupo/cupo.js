(() => {
  const activities = {
    kayak: {
      unit: 'Kayaks',
      singular: 'kayak',
      plural: 'kayaks',
      priceInCents: 1800,
      slots: [
        { daysAhead: 2, time: '10:00', remaining: 4 },
        { daysAhead: 2, time: '12:30', remaining: 2 },
        { daysAhead: 4, time: '10:00', remaining: 6 },
      ],
    },
    ruta: {
      unit: 'Personas',
      singular: 'persona',
      plural: 'personas',
      priceInCents: 3500,
      slots: [
        { daysAhead: 2, time: '17:30', remaining: 3 },
        { daysAhead: 3, time: '17:30', remaining: 5 },
        { daysAhead: 4, time: '17:30', remaining: 2 },
      ],
    },
  };

  const activity = document.getElementById('demo-activity');
  const slots = document.getElementById('demo-slots');
  const quantity = document.getElementById('demo-quantity');
  const total = document.getElementById('demo-total');
  const deposit = document.getElementById('demo-deposit');
  const balance = document.getElementById('demo-balance');
  const unit = document.getElementById('demo-unit');
  const selection = document.getElementById('demo-selection');
  const confirm = document.getElementById('demo-confirm');
  const receipt = document.getElementById('demo-receipt');
  const receiptTitle = document.getElementById('receipt-title');
  const receiptActivity = document.getElementById('receipt-activity');
  const receiptSlot = document.getElementById('receipt-slot');
  const receiptQuantity = document.getElementById('receipt-quantity');
  const receiptDeposit = document.getElementById('receipt-deposit');
  const receiptTotal = document.getElementById('receipt-total');
  const receiptBalance = document.getElementById('receipt-balance');

  const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const date = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const compactDate = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const today = new Date();
  let selectedSlot = 0;

  function dateLabel(daysAhead, formatter = date) {
    const day = new Date(today);
    day.setDate(day.getDate() + daysAhead);
    return formatter.format(day);
  }

  function renderSlots() {
    const current = activities[activity.value];
    slots.replaceChildren();
    current.slots.forEach((slot, index) => {
      const label = document.createElement('label');
      const radio = document.createElement('input');
      const time = document.createElement('time');
      const dateText = document.createElement('span');
      const remaining = document.createElement('span');
      const day = dateLabel(slot.daysAhead);

      label.className = 'slot slot-grid';
      radio.type = 'radio';
      radio.name = 'demo-slot';
      radio.value = String(index);
      radio.checked = index === selectedSlot;
      const availability = slot.remaining === 1 ? 'plaza disponible' : 'plazas disponibles';
      radio.setAttribute('aria-label', `${day}, ${slot.time}, ${slot.remaining} ${availability}`);
      time.dateTime = slot.time;
      time.textContent = slot.time;
      dateText.className = 'slot-date';
      dateText.textContent = dateLabel(slot.daysAhead, compactDate);
      remaining.className = 'slot-remaining';
      remaining.textContent = String(slot.remaining);
      label.append(radio, time, dateText, remaining);
      slots.append(label);
    });
  }

  function renderQuantities(previousQuantity = 1) {
    const current = activities[activity.value];
    const { remaining } = current.slots[selectedSlot];
    quantity.replaceChildren();
    for (let count = 1; count <= remaining; count += 1) {
      quantity.add(new Option(String(count), String(count)));
    }
    quantity.value = String(Math.min(previousQuantity, remaining));
    unit.textContent = current.unit;
  }

  function renderSummary() {
    const current = activities[activity.value];
    const slot = current.slots[selectedSlot];
    const count = Number(quantity.value);
    const fullPrice = count * current.priceInCents;
    const depositAmount = Math.round(fullPrice * 0.2);

    total.textContent = currency.format(fullPrice / 100);
    deposit.textContent = currency.format(depositAmount / 100);
    balance.textContent = currency.format((fullPrice - depositAmount) / 100);
    const slotLabel = `${dateLabel(slot.daysAhead)}, ${slot.time}`;
    const quantityLabel = `${count} ${count === 1 ? current.singular : current.plural}`;
    selection.textContent = `${slotLabel} · ${quantityLabel}`;
    receipt.hidden = true;
    receiptActivity.textContent = activity.selectedOptions[0].textContent;
    receiptSlot.textContent = slotLabel;
    receiptQuantity.textContent = quantityLabel;
    receiptDeposit.textContent = deposit.textContent;
    receiptTotal.textContent = total.textContent;
    receiptBalance.textContent = balance.textContent;
  }

  activity.addEventListener('change', () => {
    selectedSlot = 0;
    renderSlots();
    renderQuantities();
    renderSummary();
  });

  slots.addEventListener('change', (event) => {
    if (event.target.name !== 'demo-slot') return;
    selectedSlot = Number(event.target.value);
    renderQuantities(Number(quantity.value));
    renderSummary();
  });

  quantity.addEventListener('change', renderSummary);
  confirm.addEventListener('click', () => {
    receipt.hidden = false;
    receiptTitle.focus();
  });

  renderSlots();
  renderQuantities();
  renderSummary();
})();
