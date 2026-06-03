// Очікуємо повного завантаження DOM-дерева
document.addEventListener("DOMContentLoaded", () => {
    
    // =========================================================================
    // 1. ЛОГІКА ДЛЯ ЗОНИ ПЕРЕТЯГУВАННЯ ТА ВИБОРУ ФАЙЛУ (Drag & Drop)
    // =========================================================================
    const initDragAndDrop = () => {
        const dropZone = document.getElementById("drop-zone");
        const fileInput = document.getElementById("zip-file");
        const dropZoneText = document.querySelector(".drop-zone-text");
        const dropZoneHint = document.querySelector(".drop-zone-hint");
        const uploadIcon = document.querySelector(".upload-icon");

        if (!dropZone || !fileInput) return;

        // Допоміжна функція: скидання стандартної поведінки браузера
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        // Допоміжна функція: оновлення інтерфейсу при успішному виборі файлу
        const updateDropZoneWithFileInfo = (fileName) => {
            uploadIcon.innerHTML = `
                <path fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            `;
            uploadIcon.style.color = "#10B981";
            
            dropZoneText.innerHTML = `Файл прикріплено: <span style="color: var(--accent-color); font-weight: 700;">${fileName}</span>`;
            dropZoneHint.textContent = "Ви можете натиснути кнопку 'Запустити деплой' для публікації.";
        };

        // Слухач на звичайний клік та вибір файлу через провідник
        fileInput.addEventListener("change", () => {
            if (fileInput.files.length > 0) {
                updateDropZoneWithFileInfo(fileInput.files[0].name);
            }
        });

        // Скасовуємо стандартну поведінку для всіх Drag&Drop подій
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        // Візуальні ефекти при наведенні файлу на зону
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--accent-color)";
                dropZone.style.backgroundColor = "rgba(139, 92, 246, 0.05)";
            }, false);
        });

        // Повернення стилів до норми, якщо файл прибрали або скинули
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--border-color)";
                dropZone.style.backgroundColor = "rgba(11, 15, 25, 0.3)";
            }, false);
        });

        // Обробка події скидання файлу (Drop)
        dropZone.addEventListener("drop", (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;

            if (files.length > 0) {
                if (files[0].name.endsWith('.zip')) {
                    fileInput.files = files; 
                    updateDropZoneWithFileInfo(files[0].name);
                } else {
                    alert("Будь ласка, завантажуйте тільки .zip архіви!");
                }
            }
        });
    };

    // =========================================================================
    // 2. ЛОГІКА ФІЛЬТРАЦІЇ ТА ПОШУКУ В КАТАЛОЗІ
    // =========================================================================
    const initCatalogFilter = () => {
        const searchInput = document.getElementById("catalog-search");
        const filterButtons = document.querySelectorAll(".filter-btn");
        const studentCards = document.querySelectorAll(".student-card");
        const noResultsBlock = document.getElementById("no-results-block");
        const resetBtn = document.getElementById("reset-search-btn");
        const portfoliosContainer = document.getElementById("portfolios-container");

        if (!searchInput || filterButtons.length === 0) return;
        
        let currentFilter = "all"; 
        let currentSearchText = ""; 

        // Головна функція фільтрації
        const filterCards = () => {
            let visibleCount = 0;

            studentCards.forEach(card => {
                const cardRole = card.getAttribute("data-role");
                const searchContent = card.getAttribute("data-search") || "";

                const matchesFilter = (currentFilter === "all") || (cardRole === currentFilter);
                const matchesSearch = searchContent.includes(currentSearchText);

                if (matchesFilter && matchesSearch) {
                    card.style.display = "flex";
                    visibleCount++;
                } else {
                    card.style.display = "none";
                }
            });
            
            // Показ/приховування блоку "Нічого не знайдено"
            if (visibleCount === 0) {
                if (portfoliosContainer) portfoliosContainer.style.display = "none"; 
                if (noResultsBlock) noResultsBlock.style.display = "flex"; 
            } else {
                if (portfoliosContainer) portfoliosContainer.style.display = "grid";
                if (noResultsBlock) noResultsBlock.style.display = "none";
            }
        };

        // Введення тексту в пошук
        searchInput.addEventListener("input", (e) => {
            currentSearchText = e.target.value.toLowerCase().trim();
            filterCards();
        });

        // Клік по кнопках категорій (фільтрів)
        filterButtons.forEach(button => {
            button.addEventListener("click", () => {
                const activeBtn = document.querySelector(".filter-btn.active");
                if (activeBtn) activeBtn.classList.remove("active");
                
                button.classList.add("active");
                currentFilter = button.getAttribute("data-filter");
                filterCards();
            });
        });

        // Кнопка скидання пошуку
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                searchInput.value = "";
                currentSearchText = "";
                
                const activeBtn = document.querySelector(".filter-btn.active");
                if (activeBtn) activeBtn.classList.remove("active");
                
                if (filterButtons[0]) filterButtons[0].classList.add("active");
                currentFilter = "all";

                filterCards();
            });
        }
    };

    // =========================================================================
    // 3. ПЕРЕВІРКА ІМЕНІ СТУДЕНТА ТА ПОПЕРЕДЖЕННЯ ПРО ЗМІНИ
    // =========================================================================
    const initStudentCheck = () => {
        const nameInput = document.getElementById("student-name");
        const nameHint = document.getElementById("student-name-hint");
        const roleSelect = document.getElementById("student-role");
        const tgInput = document.getElementById("student-tg");
        const emailInput = document.getElementById("student-email");

        if (!nameInput || !nameHint) return;

        let debounceTimer;
        let serverData = null; 

        // Перевірка, чи змінилися дані порівняно з базою
        const checkFieldsChange = () => {
            if (!serverData) return;

            const roleChanged = roleSelect && roleSelect.value && roleSelect.value !== serverData.role;
            const tgChanged = tgInput && tgInput.value && tgInput.value.trim() !== serverData.tg;
            const emailChanged = emailInput && emailInput.value && emailInput.value.trim() !== serverData.email;

            if (roleChanged || tgChanged || emailChanged) {
                nameHint.style.color = "#F59E0B"; 
                nameHint.innerHTML = `⚠️ <strong>Увага:</strong> Введені дані (Роль/ТГ/Email) відрізняються від твоїх попередніх проєктів. Після деплою контакти у твоєму профілі оновляться на нові!`;
            } else {
                nameHint.style.color = "#10B981"; 
                nameHint.innerHTML = `✨ З поверненням! Ви вже опублікували <strong>${serverData.project_count}</strong> проєкт(ів). Наступний додасться до вашого профілю.`;
            }
        };

        // Навішуємо слухачі на поля контактів
        [roleSelect, tgInput, emailInput].forEach(element => {
            if (element) {
                element.addEventListener("change", checkFieldsChange);
                element.addEventListener("input", checkFieldsChange);
            }
        });

        // Валідація імені з Debounce (затримка 500мс для зменшення запитів до API)
        nameInput.addEventListener("input", () => {
            clearTimeout(debounceTimer);
            const nameValue = nameInput.value.trim();

            if (nameValue.length < 2) {
                nameHint.textContent = "";
                serverData = null;
                return;
            }

            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/check-student?name=${encodeURIComponent(nameValue)}`);
                    const data = await response.json();

                    if (data.exists) {
                        serverData = data; 
                        
                        // Автозаповнення полів, якщо вони порожні
                        if (roleSelect && !roleSelect.value) roleSelect.value = data.role;
                        if (tgInput && !tgInput.value) tgInput.value = data.tg;
                        if (emailInput && !emailInput.value) emailInput.value = data.email;

                        checkFieldsChange();
                    } else {
                        serverData = null;
                        nameHint.style.color = "var(--text-muted)";
                        nameHint.textContent = "🆕 Новий профіль розробника буде створено після деплою.";
                    }
                } catch (error) {
                    console.error("Помилка перевірки імені:", error);
                }
            }, 500);
        });
    };

    // =========================================================================
    // 4. ЛОГІКА БУРГЕР-МЕНЮ (Мобільна навігація)
    // =========================================================================
    const initBurgerMenu = () => {
        const burgerMenu = document.querySelector('.burger-menu');
        const navMenu = document.querySelector('.nav-menu');
        const navLinks = document.querySelectorAll('.nav-link');

        if (!burgerMenu || !navMenu) return;

        // Перемикач меню
        burgerMenu.addEventListener('click', () => {
            burgerMenu.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });

        // Закриття меню при кліку на посилання
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                burgerMenu.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    };

    // =========================================================================
    // Ініціалізація всіх модулів
    // =========================================================================
    initDragAndDrop();
    initCatalogFilter();
    initStudentCheck();
    initBurgerMenu();
});






// Додаткові слухачі для оновлення назв вибраних файлів поруч з інпутами

document.getElementById('zip_file').addEventListener('change', function() {
        const name = this.files[0] ? this.files[0].name : 'Файл не вибрано';
        document.getElementById('zip-label').textContent = name;
    });

    document.getElementById('preview_image').addEventListener('change', function() {
        const name = this.files[0] ? this.files[0].name : 'Файл не вибрано';
        document.getElementById('preview-label').textContent = name;
    });