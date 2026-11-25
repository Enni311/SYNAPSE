(() => {
    'use strict';

    const root = document.documentElement;
    const header = document.querySelector('.site-header');
    const menuButton = document.querySelector('.mobile-toggle');
    const mobileMenu = document.querySelector('.mobile-panel');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(pointer: fine)');

    function closeMenu() {
        if (!menuButton || !mobileMenu) return;
        menuButton.setAttribute('aria-expanded', 'false');
        menuButton.setAttribute('aria-label', 'Відкрити меню');
        mobileMenu.classList.remove('is-open');
        document.body.classList.remove('no-scroll');
    }

    if (menuButton && mobileMenu) {
        menuButton.addEventListener('click', () => {
            const open = menuButton.getAttribute('aria-expanded') !== 'true';
            menuButton.setAttribute('aria-expanded', String(open));
            menuButton.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню');
            mobileMenu.classList.toggle('is-open', open);
            document.body.classList.toggle('no-scroll', open);
        });

        mobileMenu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMenu();
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 990) closeMenu();
        }, { passive: true });
    }

    const updateHeader = () => {
        header?.classList.toggle('scrolled', window.scrollY > 10);
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    // v3 motion engine: every section navigation is animated without requesting a page.
    // We disable CSS smooth scrolling while our requestAnimationFrame transition runs.
    // Otherwise some browsers apply two separate easing functions, making motion appear to jump.
    const sectionIDs = ['hero', 'robots', 'technology', 'solutions', 'research', 'news', 'about', 'contact'];
    const sections = sectionIDs.map((id) => document.getElementById(id)).filter(Boolean);
    const isHome = sections.length === sectionIDs.length;
    let motionEnabled = true;
    let revealObserver = null;
    let scrollFrame = 0;
    let scrollTween = 0;
    let scrollTweenToken = 0;
    const revealNodes = [...document.querySelectorAll('[data-reveal]')];
    const images = [...document.querySelectorAll(
        '.product-card__image, .tile-card__visual img, .news-card__image img, ' +
        '.technology-showcase__image img, .research-feature__visual img, ' +
        '.company-feature__image img, .model-hero__image, ' +
        '.model-details__visual img, .tech-module__visual img'
    )];

    document.querySelectorAll('.product-grid, .tile-grid, .news-grid').forEach((grid) => {
        grid.querySelectorAll(':scope > [data-reveal]').forEach((card, index) => {
            card.style.setProperty('--motion-delay', `${index * 170}ms`);
            card.style.setProperty('--card-number', String(index + 1).padStart(2, '0'));
        });
    });
    document.querySelectorAll('.research-feature__list > *, .technology-showcase__labels > *, .spec-strip__item').forEach((item, index) => {
        item.style.setProperty('--motion-delay', `${(index % 5) * 110}ms`);
    });

    function isOnScreen(element, margin = 0) {
        const rect = element.getBoundingClientRect();
        return rect.bottom > -margin && rect.top < window.innerHeight + margin;
    }

    function revealVisible() {
        revealNodes.forEach((node) => {
            if (isOnScreen(node, -20)) node.classList.add('in-view');
        });
    }

    function setMotion(enabled) {
        motionEnabled = enabled;
        root.classList.toggle('motion-active', enabled);
        root.classList.toggle('motion-disabled', !enabled);
        root.classList.toggle('motion-opt-in', enabled);
        if (revealObserver) { revealObserver.disconnect(); revealObserver = null; }
        if (enabled && 'IntersectionObserver' in window) {
            revealObserver = new IntersectionObserver(entries => {
                for (const entry of entries) if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    revealObserver.unobserve(entry.target);
                }
            }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
            revealNodes.forEach(node => { if (!node.classList.contains('in-view')) revealObserver.observe(node); });
        } else revealNodes.forEach(node => node.classList.add('in-view'));
        requestAnimationFrame(() => requestAnimationFrame(revealVisible));
        queueScrollMotion();
    }
    setMotion(true);

    const curtain = document.createElement('div');
    curtain.className = 'page-curtain';
    curtain.setAttribute('aria-hidden', 'true');
    document.body.appendChild(curtain);
    const transitionKey = 'synapse-v5-navigation';
    let navigating = false;
    function enterPage() {
        navigating = false;
        root.classList.remove('page-leaving');
        let arriving = false;
        try { arriving = sessionStorage.getItem(transitionKey) === '1'; sessionStorage.removeItem(transitionKey); } catch (_) {}
        if (arriving) {
            root.classList.add('page-entering');
            requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('page-entering')));
        }
    }
    enterPage();
    window.addEventListener('pageshow', e => { if (e.persisted) enterPage(); });
    document.addEventListener('click', e => {
        if (navigating || e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        const link = e.target.closest('a[href]');
        if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
        const target = new URL(link.href, location.href);
        if (!['http:', 'https:', 'file:'].includes(target.protocol) || target.origin !== location.origin) return;
        if (target.pathname === location.pathname && target.search === location.search) return;
        e.preventDefault();
        navigating = true;
        closeMenu();
        root.classList.add('page-leaving');
        try { sessionStorage.setItem(transitionKey, '1'); } catch (_) {}
        setTimeout(() => location.assign(target.href), 440);
    });

    const progressBar = document.createElement('div');
    progressBar.className = 'scroll-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progressBar);

    // Floating section navigator: it gives clear live feedback while scrolling.
    let sectionRail = null;
    let activeID = 'hero';
    const captions = ['Початок','Роботи','Технології','Рішення','Дослідження','Новини','Про нас','Контакти'];
    if (isHome) {
        sectionRail = document.createElement('nav');
        sectionRail.className = 'section-rail';
        sectionRail.setAttribute('aria-label', 'Швидка навігація по секціях');
        sectionRail.innerHTML = sectionIDs.map((id, index) =>
            `<a class="section-rail__item" href="#${id}" aria-label="${captions[index]}" title="${captions[index]}">` +
            `<span class="section-rail__index">${String(index + 1).padStart(2, '0')}</span>` +
            `<span class="section-rail__line" aria-hidden="true"></span></a>`
        ).join('');
        document.body.appendChild(sectionRail);
    }
    const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"], .mobile-panel a[href^="#"], .section-rail a[href^="#"]')];
    const getHeaderHeight = () => header?.offsetHeight ?? 0;
    const targetY = (target) => target.id === 'hero' ? 0 :
        Math.max(0, Math.round(window.scrollY + target.getBoundingClientRect().top - getHeaderHeight() - 18));

    function highlightSection(id) {
        if (activeID === id && navLinks.some((x) => x.getAttribute('aria-current') === 'location')) return;
        activeID = id;
        for (const link of navLinks) {
            if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
            else link.removeAttribute('aria-current');
        }
    }

    function stopAnimatedScroll() {
        ++scrollTweenToken;
        if (scrollTween) cancelAnimationFrame(scrollTween);
        scrollTween = 0;
        root.classList.remove('scroll-is-animating');
    }

    function navigate(target, options = {}) {
        stopAnimatedScroll();
        const finish = () => {
            if (options.focus) {
                if (!target.hasAttribute('tabindex')) target.tabIndex = -1;
                target.focus({ preventScroll: true });
            }
            highlightSection(target.id);
        };
        const from = window.scrollY;
        const to = targetY(target);
        const distance = to - from;
        if (!motionEnabled || options.immediate || Math.abs(distance) < 3) {
            root.classList.add('scroll-is-animating');
            window.scrollTo(0, to);
            root.classList.remove('scroll-is-animating');
            finish();
            return;
        }
        const duration = Math.min(1850, Math.max(1050, 950 + Math.abs(distance) * .19));
        const startedAt = performance.now();
        const token = scrollTweenToken;
        root.classList.add('scroll-is-animating');
        function tick(now) {
            if (token !== scrollTweenToken) return;
            const t = Math.min(1, (now - startedAt) / duration);
            const eased = t * t * (3 - 2 * t); // smoothstep, visibly in motion right away
            window.scrollTo(0, from + distance * eased);
            if (t < 1) scrollTween = requestAnimationFrame(tick);
            else { scrollTween = 0; root.classList.remove('scroll-is-animating'); finish(); }
        }
        scrollTween = requestAnimationFrame(tick);
    }

    if (isHome) {
        document.addEventListener('click', (event) => {
            if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
            const anchor = event.target.closest('a[href^="#"]');
            if (!anchor || anchor.hasAttribute('download')) return;
            const id = decodeURIComponent(anchor.getAttribute('href').slice(1));
            const target = id ? document.getElementById(id) : null;
            if (!target) return;
            event.preventDefault();
            closeMenu();
            if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
            navigate(target, { focus: true });
        });
        window.addEventListener('popstate', () => {
            const target = document.getElementById(decodeURIComponent(location.hash.slice(1))) || sections[0];
            navigate(target);
        });
        window.addEventListener('load', () => {
            const id = decodeURIComponent(location.hash.slice(1));
            const target = document.getElementById(id);
            if (target) requestAnimationFrame(() => navigate(target, { immediate: true }));
        });
    }

    ['wheel','touchstart','pointerdown'].forEach((name) => window.addEventListener(name, stopAnimatedScroll, { passive: true }));
    window.addEventListener('keydown', (event) => {
        if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key)) stopAnimatedScroll();
    });

    // Scroll-responsive robots: actual dynamic transforms, not a static CSS screenshot.
    let heroPointerRAF = 0;
    let pointerX = 0, pointerY = 0;
    const hero = document.querySelector('.hero');
    if (hero && finePointer.matches) {
        hero.addEventListener('pointermove', (event) => {
            if (!motionEnabled || innerWidth < 991) return;
            const rect = hero.getBoundingClientRect();
            pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width/2) / (rect.width/2)));
            pointerY = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height/2) / (rect.height/2)));
            if (heroPointerRAF) return;
            heroPointerRAF = requestAnimationFrame(() => {
                hero.style.setProperty('--robot-x', `${(pointerX * 19).toFixed(1)}px`);
                hero.style.setProperty('--robot-y', `${(pointerY * 12).toFixed(1)}px`);
                hero.style.setProperty('--light-x', `${(pointerX * 42).toFixed(1)}px`);
                hero.style.setProperty('--light-y', `${(pointerY * 26).toFixed(1)}px`);
                heroPointerRAF = 0;
            });
        }, { passive: true });
        hero.addEventListener('pointerleave', () => {
            hero.style.setProperty('--robot-x','0px');
            hero.style.setProperty('--robot-y','0px');
            hero.style.setProperty('--light-x','0px');
            hero.style.setProperty('--light-y','0px');
        });
    }

    function updateScrollMotion() {
        scrollFrame = 0;
        const maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight);
        progressBar.style.transform = `scaleX(${(scrollY / maxY).toFixed(5)})`;
        header?.classList.toggle('scrolled', scrollY > 8);
        if (isHome) {
            const probe = scrollY + getHeaderHeight() + Math.min(innerHeight * .35, 245);
            let id = 'hero';
            for (const section of sections) {
                if (section.getBoundingClientRect().top + scrollY <= probe) id = section.id;
            }
            highlightSection(id);
        }
        if (!motionEnabled) return;
        if (hero) {
            const y = Math.max(0, Math.min(scrollY, Math.min(hero.offsetHeight, 900)));
            hero.style.setProperty('--hero-scroll-lift', `${Math.round(y * .15)}px`);
            hero.style.setProperty('--hero-word-lift', `${Math.round(y * -.065)}px`);
            hero.style.setProperty('--hero-robot-rotate', `${(Math.min(y,650) / 650 * 1.4).toFixed(2)}deg`);
        }
        for (const img of images) {
            const container = img.closest('.product-card, .tile-card, .news-card, .technology-showcase, .research-feature, .company-feature, .model-hero, .model-details, .tech-module');
            if (!container) continue;
            const rect = container.getBoundingClientRect();
            if (rect.bottom < -80 || rect.top > innerHeight + 80) continue;
            const normalized = Math.max(-1,Math.min(1,(rect.top + rect.height * .5 - innerHeight * .5) / (innerHeight * .68)));
            const product = img.classList.contains('product-card__image');
            img.style.setProperty('--scroll-shift', `${(-normalized * (product ? 43 : 25)).toFixed(1)}px`);
            if (product) img.style.setProperty('--scroll-rotate', `${(-normalized * 2.1).toFixed(2)}deg`);
        }
    }

    function queueScrollMotion() {
        if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollMotion);
    }
    queueScrollMotion();
    window.addEventListener('scroll', queueScrollMotion, { passive: true });
    window.addEventListener('resize', queueScrollMotion, { passive: true });

    // Small count-up sequence, once per element, when the relevant metric is reached.
    const numberElements = [...document.querySelectorAll('.spec-strip__item strong, .company-feature__stats strong')];
    function startCounter(element) {
        if (element.dataset.counted) return;
        element.dataset.counted = 'true';
        if (!motionEnabled) return;
        const original = element.textContent.trim();
        const match = original.match(/\d+(?:[.,]\d+)?/);
        if (!match) return;
        const value = Number(match[0].replace(',','.'));
        if (!Number.isFinite(value)) return;
        const startAt = performance.now();
        function tick(now) {
            if (!motionEnabled) { element.textContent = original; return; }
            const t = Math.min(1, (now - startAt) / 1100);
            const eased = 1 - (1-t)**3;
            const part = value * eased;
            const label = match[0].includes('.') || match[0].includes(',') ?
                part.toFixed(match[0].split(/[.,]/)[1].length).replace('.', match[0].includes(',') ? ',' : '.') :
                String(Math.round(part));
            element.textContent = original.replace(match[0], label);
            if (t < 1) requestAnimationFrame(tick); else element.textContent = original;
        }
        requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
        const metricsObserver = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) { startCounter(entry.target); metricsObserver.unobserve(entry.target); }
            }
        }, { threshold: .5 });
        numberElements.forEach((element) => metricsObserver.observe(element));
    }

    document.querySelectorAll('[data-filter-group]').forEach((group) => {
        const targetSelector = group.getAttribute('data-filter-target');
        const items = Array.from(document.querySelectorAll(targetSelector));
        const controls = group.querySelectorAll('[data-filter]');
        controls.forEach((button) => {
            button.addEventListener('click', () => {
                const value = button.getAttribute('data-filter');
                controls.forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
                items.forEach((item) => {
                    const category = item.getAttribute('data-category') || '';
                    item.hidden = value !== 'all' && category !== value;
                });
            });
        });
    });

    const descriptions = {
        core: 'AI Core інтегрує дані сенсорів та адаптивні моделі прийняття рішень. Кожна дія прораховується з урахуванням контексту й безпеки.',
        vision: 'Computer Vision поєднує камери, просторову оцінку та розпізнавання об’єктів для точного розуміння середовища.',
        motion: 'Motion Control синхронізує приводи, суглоби та баланс роботів для прогнозованого, плавного й точного руху.'
    };
    document.querySelectorAll('[data-tech-tabs]').forEach((group) => {
        const output = document.querySelector(group.getAttribute('data-output'));
        group.querySelectorAll('[data-tech]').forEach((button) => {
            button.addEventListener('click', () => {
                group.querySelectorAll('[data-tech]').forEach((item) => {
                    item.setAttribute('aria-selected', String(item === button));
                    item.tabIndex = item === button ? 0 : -1;
                });
                if (output) output.textContent = descriptions[button.getAttribute('data-tech')] || '';
            });
        });
    });

    const form = document.querySelector('[data-contact-form]');
    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!form.reportValidity()) return;
            const data = new FormData(form);
            const message = [
                'ЗАПИТ НА СПІВПРАЦЮ — SYNAPSE ROBOTICS',
                '',
                `Ім’я: ${data.get('name')}`,
                `Email: ${data.get('email')}`,
                `Напрям: ${data.get('interest')}`,
                '',
                'Повідомлення:',
                String(data.get('message') || ''),
            ].join('\n');
            const status = form.querySelector('.form-status');
            try {
                if (!navigator.clipboard?.writeText) throw new Error('No clipboard');
                await navigator.clipboard.writeText(message);
                if (status) status.textContent = 'Текст запиту скопійовано. Можете вставити його в лист або месенджер.';
            } catch {
                const blob = new Blob([message], { type: 'text/plain;charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'synapse-request.txt';
                link.click();
                setTimeout(() => URL.revokeObjectURL(link.href), 3000);
                if (status) status.textContent = 'Запит збережено в текстовий файл.';
            }
        });
    }
})();
