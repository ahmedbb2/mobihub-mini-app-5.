
(() => {
  const tg = window.Telegram?.WebApp;

  const API_URL =
    'https://mobihub-telegram-proxy.ahmedmtarek20.workers.dev/';

  const $ = (id) => document.getElementById(id);

  const titles = {
    requests: 'طلباتي',
    leaves: 'طلبات الأذونات',
    complaints: 'الشكاوى',
    cash: 'العهد والسلف'
  };

  let initData = '';

  function fail(message) {
    $('error').textContent = message;
    $('error').classList.remove('hidden');
    $('connection').textContent = 'تعذر الاتصال';
  }

  async function api(action, extra = {}) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        initData,
        action,
        ...extra
      })
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.error || 'تعذر تنفيذ الطلب');
    }

    return result.data;
  }

  function renderStats(summary) {
    const items = [
      ['طلباتي', summary.myRequests],
      ['الأذونات', summary.myLeaves],
      ['شكاواي', summary.myComplaints],
      ['الشكاوى المفتوحة', summary.openComplaints]
    ];

    $('stats').innerHTML = items.map(([label, value]) =>
      `<div class="stat"><b>${Number(value) || 0}</b><span>${label}</span></div>`
    ).join('');
  }

  async function start() {
    if (!tg) {
      return fail('افتح التطبيق من زر Mini App داخل بوت MobiHub.');
    }

    tg.ready();
    tg.expand();

    initData = tg.initData || '';

    if (!initData) {
      return fail('بيانات Telegram غير متاحة. افتح التطبيق من داخل Telegram.');
    }

    try {
      const data = await api('bootstrap');

      $('userName').textContent = data.profile.name;

      const roleNames = {
        employee: 'موظف',
        supervisor: 'مشرف',
        admin: 'مدير',
        finance: 'مالية',
        super_admin: 'مدير النظام'
      };

      $('userRole').textContent =
        roleNames[data.profile.role] || data.profile.role;

      renderStats(data.summary);

      if (data.permissions.viewManagement) {
        $('management').classList.remove('hidden');
      }

      $('connection').textContent = 'متصل';
      $('connection').style.color = '#8be0aa';

    } catch (e) {
      fail(e.message === 'Failed to fetch'
        ? 'تعذر الاتصال بالخدمة. راجع إعدادات Cloudflare Worker.'
        : e.message);
    }
  }

  async function showList(entity) {
    $('results').classList.remove('hidden');
    $('resultTitle').textContent = titles[entity] || 'السجلات';
    $('resultBody').textContent = 'جاري التحميل...';

    try {
      const rows = await api('list', { entity });

      if (!rows.length) {
        $('resultBody').textContent = 'لا توجد سجلات.';
        return;
      }

      $('resultBody').innerHTML = rows.map(row => {
        const title =
          row['رقم الطلب'] ||
          row['رقم الشكوى'] ||
          row['نوع الطلب'] ||
          row['نوع الإذن'] ||
          'سجل';

        const status = row['الحالة'] || row['القرار'] || '';
        const date = row['التاريخ والوقت'] || row['تاريخ الإرسال'] || '';

        return `
          <article class="record">
            <strong>${escapeHtml(title)}</strong>
            <small>${escapeHtml(status)} · ${escapeHtml(date)}</small>
          </article>
        `;
      }).join('');

    } catch (e) {
      $('resultBody').textContent = e.message;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  document.querySelectorAll('[data-entity]').forEach(btn => {
    btn.addEventListener('click', () => showList(btn.dataset.entity));
  });

  $('backBtn').addEventListener('click', () => {
    $('results').classList.add('hidden');
  });

  start();
})();
