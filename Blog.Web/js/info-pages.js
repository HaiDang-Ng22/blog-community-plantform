(function () {
    'use strict';

    const body = document.body;
    const nav = document.querySelector('.info-nav');
    const navInner = document.querySelector('.info-nav-inner');
    const navLinks = document.querySelector('.info-nav-links');
    const currentPage = (location.pathname.split('/').pop() || 'index.html').toLowerCase();

    body.classList.add('info-page');

    if (nav && navInner && navLinks) {
        navLinks.querySelectorAll('a').forEach((link) => {
            const target = (link.getAttribute('href') || '').split('?')[0].toLowerCase();
            link.classList.toggle('active', target === currentPage);
            if (target === currentPage) link.setAttribute('aria-current', 'page');
        });

        const homeLink = document.createElement('a');
        homeLink.className = 'info-home-link';
        homeLink.href = 'index.html';
        homeLink.setAttribute('aria-label', 'Quay lại Zynk');
        homeLink.innerHTML = '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i><span>Quay lại Zynk</span>';

        const menuButton = document.createElement('button');
        menuButton.className = 'info-menu-toggle';
        menuButton.type = 'button';
        menuButton.setAttribute('aria-label', 'Mở menu thông tin');
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';

        navInner.append(homeLink, menuButton);
        menuButton.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('menu-open');
            menuButton.setAttribute('aria-expanded', String(isOpen));
            menuButton.setAttribute('aria-label', isOpen ? 'Đóng menu thông tin' : 'Mở menu thông tin');
            menuButton.innerHTML = `<i class="fa-solid fa-${isOpen ? 'xmark' : 'bars'}" aria-hidden="true"></i>`;
        });

        navLinks.addEventListener('click', () => {
            nav.classList.remove('menu-open');
            menuButton.setAttribute('aria-expanded', 'false');
            menuButton.setAttribute('aria-label', 'Mở menu thông tin');
            menuButton.innerHTML = '<i class="fa-solid fa-bars" aria-hidden="true"></i>';
        });
    }

    document.querySelectorAll('.faq-question').forEach((question) => {
        question.setAttribute('role', 'button');
        question.setAttribute('tabindex', '0');
        question.setAttribute('aria-expanded', 'false');

        const toggleFaq = () => {
            const item = question.closest('.faq-item');
            if (!item) return;
            const isOpen = item.classList.toggle('open');
            question.setAttribute('aria-expanded', String(isOpen));
        };

        question.addEventListener('click', toggleFaq);
        question.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleFaq();
            }
        });
    });

    const searchInput = document.querySelector('.search-box');
    if (searchInput) {
        searchInput.setAttribute('aria-label', 'Tìm kiếm trong trung tâm trợ giúp');
        searchInput.addEventListener('input', (event) => {
            const query = event.target.value.trim().toLocaleLowerCase('vi');
            document.querySelectorAll('.faq-item').forEach((item) => {
                item.hidden = query.length > 0 && !item.textContent.toLocaleLowerCase('vi').includes(query);
            });
        });
    }

    const footer = document.querySelector('.info-footer');
    if (footer) {
        footer.innerHTML = `
            <div class="info-footer-inner">
                <div class="footer-brand">
                    <a class="footer-logo" href="index.html">Zynk</a>
                    <p>Một không gian số hiện đại để kết nối, chia sẻ giá trị và cùng nhau xây dựng những cộng đồng có ý nghĩa.</p>
                    <span class="footer-status">Hệ thống đang hoạt động ổn định</span>
                </div>
                <div class="footer-links-grid">
                    <div class="footer-column">
                        <strong>Khám phá</strong>
                        <a href="index.html">Bảng tin</a>
                        <a href="marketplace.html">Khám phá</a>
                        <a href="groups.html">Cộng đồng</a>
                        <a href="marketplace.html">Marketplace</a>
                    </div>
                    <div class="footer-column">
                        <strong>Về Zynk</strong>
                        <a href="about.html">Giới thiệu</a>
                        <a href="press.html">Báo chí</a>
                        <a href="jobs.html">Việc làm</a>
                        <a href="api.html">API</a>
                    </div>
                    <div class="footer-column">
                        <strong>Hỗ trợ</strong>
                        <a href="help.html">Trung tâm trợ giúp</a>
                        <a href="privacy.html">Quyền riêng tư</a>
                        <a href="terms.html">Điều khoản</a>
                        <a href="mailto:support@zynk.app">Liên hệ hỗ trợ</a>
                    </div>
                </div>
            </div>
            <div class="footer-bottom">
                <span>© 2026 Zynk Community. All rights reserved.</span>
                <span>Kết nối theo cách của bạn.</span>
            </div>`;
    }
})();
