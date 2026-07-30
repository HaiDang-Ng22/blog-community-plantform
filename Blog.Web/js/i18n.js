// Zynk i18n core: instant, persistent and dynamic-page aware.
(function () {
    if (window.__zynkI18nInitialized) {
        window.applyTranslations?.();
        return;
    }
    window.__zynkI18nInitialized = true;

    const supportedLanguages = ['vi', 'en', 'ja'];
    let currentLang = supportedLanguages.includes(localStorage.getItem('zynk_lang'))
        ? localStorage.getItem('zynk_lang')
        : 'vi';

    function translate(key) {
        if (!key || !window.zynkTranslations) return key;
        const dictionary = window.zynkTranslations[currentLang] || window.zynkTranslations.vi || {};
        const fallback = window.zynkTranslations.vi || {};
        return dictionary[key] ?? fallback[key] ?? key;
    }

    function translateElement(element) {
        if (!(element instanceof Element)) return;

        const textKey = element.getAttribute('data-i18n');
        if (textKey) {
            const value = translate(textKey);
            if (element.matches('input,textarea')) {
                if (element.hasAttribute('placeholder')) element.placeholder = value;
                else if (!element.value) element.value = value;
            } else if (element.hasAttribute('data-i18n-html')) {
                element.innerHTML = value;
            } else if (element.textContent !== value) {
                element.textContent = value;
            }
        }

        const attributeMap = {
            'data-i18n-placeholder': 'placeholder',
            'data-i18n-label': 'aria-label',
            'data-i18n-tooltip': 'title'
        };
        Object.entries(attributeMap).forEach(([source, target]) => {
            const key = element.getAttribute(source);
            if (key) element.setAttribute(target, translate(key));
        });
    }

    window.t = translate;
    window.getCurrentLanguage = () => currentLang;
    window.applyTranslations = function (root = document) {
        if (root instanceof Element) translateElement(root);
        root.querySelectorAll?.('[data-i18n],[data-i18n-placeholder],[data-i18n-label],[data-i18n-tooltip]')
            .forEach(translateElement);

        const titleKey = document.body?.getAttribute('data-i18n-title');
        if (titleKey) document.title = translate(titleKey);
        document.documentElement.lang = currentLang;
    };

    window.changeLanguage = function (langCode, options = {}) {
        if (!supportedLanguages.includes(langCode) || !window.zynkTranslations?.[langCode]) return false;

        const { persist = true, notify = true } = options;
        currentLang = langCode;
        if (persist) localStorage.setItem('zynk_lang', langCode);
        window.applyTranslations();

        if (notify) {
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: langCode }));
        }
        return true;
    };

    function startDynamicTranslation() {
        window.applyTranslations();
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) window.applyTranslations(node);
            }));
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startDynamicTranslation, { once: true });
    } else {
        startDynamicTranslation();
    }

    window.addEventListener('navUpdated', () => window.applyTranslations());
})();
