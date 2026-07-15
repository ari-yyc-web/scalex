        (function() {
            'use strict';

            // ---- THEME TOGGLE ----
            const themeToggle = document.getElementById('themeToggle');
            const toggleDot = document.getElementById('toggleDot');
            const html = document.documentElement;

            const hour = new Date().getHours();
            const isNightTime = hour >= 18 || hour < 6;

            const storedTheme = localStorage.getItem('scalex-theme');
            let currentTheme = storedTheme || (isNightTime ? 'dark' : 'light');

            function setTheme(theme) {
                currentTheme = theme;
                html.setAttribute('data-theme', theme);
                localStorage.setItem('scalex-theme', theme);

                const icons = themeToggle.querySelectorAll('.toggle-icon');
                if (toggleDot) {
                    if (theme === 'dark') {
                        toggleDot.classList.add('dark');
                        icons.forEach(icon => icon.classList.remove('active'));
                        document.querySelector('.toggle-icon.moon')?.classList.add('active');
                    } else {
                        toggleDot.classList.remove('dark');
                        icons.forEach(icon => icon.classList.remove('active'));
                        document.querySelector('.toggle-icon.sun')?.classList.add('active');
                    }
                }
            }

            setTheme(currentTheme);

            themeToggle.addEventListener('click', function() {
                const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                setTheme(newTheme);
            });

            // ---- HAMBURGER ----
            const hamburger = document.getElementById('hamburger');
            const mobileMenu = document.getElementById('mobileMenu');
            let menuOpen = false;

            function toggleMenu(open) {
                menuOpen = (open !== undefined) ? open : !menuOpen;
                hamburger.classList.toggle('active', menuOpen);
                mobileMenu.classList.toggle('open', menuOpen);
                hamburger.setAttribute('aria-expanded', menuOpen);
                document.body.style.overflow = menuOpen ? 'hidden' : '';
            }

            hamburger.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleMenu();
            });

            document.querySelectorAll('.mobile-link').forEach(function(link) {
                link.addEventListener('click', function() {
                    if (menuOpen) toggleMenu(false);
                });
            });

            document.addEventListener('click', function(e) {
                if (menuOpen && !mobileMenu.contains(e.target) && !hamburger.contains(e.target)) {
                    toggleMenu(false);
                }
            });

            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && menuOpen) toggleMenu(false);
            });

            // ---- NAVBAR SCROLL ----
            const navbar = document.getElementById('navbar');

            function handleScroll() {
                const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
                if (currentScroll > 20) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }

            let ticking = false;
            window.addEventListener('scroll', function() {
                if (!ticking) {
                    window.requestAnimationFrame(function() {
                        handleScroll();
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });

            handleScroll();

            // ---- SCROLL REVEAL ----
            const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');

            if (revealElements.length) {
                const observer = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('visible');
                        }
                    });
                }, {
                    root: null,
                    rootMargin: '0px 0px -60px 0px',
                    threshold: 0.1
                });

                revealElements.forEach(function(el) {
                    observer.observe(el);
                });
            }

            // ---- SMOOTH ANCHOR SCROLL ----
            document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
                anchor.addEventListener('click', function(e) {
                    const targetId = this.getAttribute('href');
                    if (targetId === '#') return;
                    const targetEl = document.querySelector(targetId);
                    if (targetEl) {
                        e.preventDefault();
                        const navHeight = navbar.offsetHeight || 68;
                        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight -
                            16;
                        window.scrollTo({
                            top: targetPos,
                            behavior: 'smooth'
                        });
                        history.pushState(null, null, targetId);
                    }
                });
            });

            // ---- ACCORDION: Services, Process, and FAQ ----
            // Generic function to toggle accordion
            function toggleAccordion(header) {
                const parent = header.closest('.service-card, .process-step');
                if (!parent) return;

                const isActive = parent.classList.contains('active');

                if (isActive) {
                    parent.classList.remove('active');
                    header.setAttribute('aria-expanded', 'false');
                } else {
                    parent.classList.add('active');
                    header.setAttribute('aria-expanded', 'true');
                }
            }

            // Attach to all .process-header (including FAQ) and .service-header
            document.querySelectorAll('.service-header, .process-header').forEach(function(header) {
                header.addEventListener('click', function(e) {
                    // If the click is on the toggle itself, we still want to trigger (it bubbles)
                    toggleAccordion(this);
                });

                header.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleAccordion(this);
                    }
                });
            });

            // Specifically for FAQ toggles: ensure clicking the plus icon triggers the header
            document.querySelectorAll('#faq .process-toggle').forEach(function(toggle) {
                toggle.addEventListener('click', function(e) {
                    e.stopPropagation(); // Prevent double firing
                    const header = this.closest('.process-header');
                    if (header) {
                        toggleAccordion(header);
                    }
                });
            });

            // ---- PRICING ACCORDION (Mobile only) ----
            const pricingToggles = document.querySelectorAll('.pricing-details-toggle');

            pricingToggles.forEach(function(toggle) {
                toggle.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const parent = this.closest('.pricing-card');
                    if (!parent) return;

                    const isActive = parent.classList.contains('active');

                    if (isActive) {
                        parent.classList.remove('active');
                        this.setAttribute('aria-expanded', 'false');
                        this.textContent = 'See what\'s included';
                    } else {
                        parent.classList.add('active');
                        this.setAttribute('aria-expanded', 'true');
                        this.textContent = 'Hide details';
                    }
                });

                toggle.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.click();
                    }
                });
            });

            // Featured card toggle visibility
            const featuredCard = document.querySelector('.pricing-card.featured');
            if (featuredCard) {
                const toggle = featuredCard.querySelector('.pricing-details-toggle');
                if (toggle) {
                    const mediaQuery = window.matchMedia('(max-width: 767px)');

                    function handleToggleVisibility(e) {
                        if (e.matches) {
                            toggle.style.display = 'inline-block';
                        } else {
                            toggle.style.display = 'none';
                            featuredCard.classList.remove('active');
                            toggle.textContent = 'See what\'s included';
                            toggle.setAttribute('aria-expanded', 'false');
                        }
                    }
                    mediaQuery.addListener(handleToggleVisibility);
                    handleToggleVisibility(mediaQuery);
                }
            }

        })();
