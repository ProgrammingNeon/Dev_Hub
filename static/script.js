document.addEventListener("DOMContentLoaded", () => {
    
    // =========================================================================
    // 1. ЛОГІКА ДЛЯ ЗОНИ ПЕРЕТЯГУВАННЯ ТА ВИБОРУ ФАЙЛУ (Drag & Drop)
    // =========================================================================
    const initDragAndDrop = () => {
        const dropZone = document.getElementById("drop-zone");
        const fileInput = document.getElementById("zip_file"); 
        const dropZoneText = document.querySelector(".drop-zone-text");
        const dropZoneHint = document.querySelector(".drop-zone-hint");
        const uploadIcon = document.querySelector(".upload-icon");

        if (!dropZone || !fileInput) return;

        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        const updateDropZoneWithFileInfo = (fileName) => {
            uploadIcon.innerHTML = `
                <path fill="none" stroke="#10B981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            `;
            uploadIcon.style.color = "#10B981";
            dropZoneText.innerHTML = `Файл прикріплено: <span style="color: var(--accent-color); font-weight: 700;">${fileName}</span>`;
            dropZoneHint.textContent = "Ви можете натиснути кнопку 'Запустити деплой' для публікації.";
        };

        fileInput.addEventListener("change", () => {
            if (fileInput.files.length > 0) {
                updateDropZoneWithFileInfo(fileInput.files[0].name);
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--accent-color)";
                dropZone.style.backgroundColor = "rgba(139, 92, 246, 0.05)";
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.style.borderColor = "var(--border-color)";
                dropZone.style.backgroundColor = "rgba(11, 15, 25, 0.3)";
            }, false);
        });

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
            
            if (visibleCount === 0) {
                if (portfoliosContainer) portfoliosContainer.style.display = "none"; 
                if (noResultsBlock) noResultsBlock.style.display = "flex"; 
            } else {
                if (portfoliosContainer) portfoliosContainer.style.display = "grid";
                if (noResultsBlock) noResultsBlock.style.display = "none";
            }
        };

        searchInput.addEventListener("input", (e) => {
            currentSearchText = e.target.value.toLowerCase().trim();
            filterCards();
        });

        filterButtons.forEach(button => {
            button.addEventListener("click", () => {
                const activeBtn = document.querySelector(".filter-btn.active");
                if (activeBtn) activeBtn.classList.remove("active");
                
                button.classList.add("active");
                currentFilter = button.getAttribute("data-filter");
                filterCards();
            });
        });

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
        const nameInput = document.getElementById("student_name");
        const nameHint = document.getElementById("student_name-hint");
        const roleSelect = document.getElementById("project_role");
        const tgInput = document.getElementById("telegram");
        const emailInput = document.getElementById("email");

        if (!nameInput || !nameHint) return;

        let debounceTimer;
        let serverData = null; 

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

        [roleSelect, tgInput, emailInput].forEach(element => {
            if (element) {
                element.addEventListener("change", checkFieldsChange);
                element.addEventListener("input", checkFieldsChange);
            }
        });

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

        burgerMenu.addEventListener('click', () => {
            burgerMenu.classList.toggle('active');
            navMenu.classList.toggle('active');
            document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
        });

        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                burgerMenu.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    };

    // =========================================================================
    // 5. ОНОВЛЕННЯ ТЕКСТОВИХ МІТОК СТАНДАРТНИХ ІНПУТІВ ФОРМИ
    // =========================================================================
    const initFileInputLabels = () => {
        const zipFileInput = document.getElementById('zip_file');
        const previewImgInput = document.getElementById('preview_image');
        const zipLabel = document.getElementById('zip-label');
        const previewLabel = document.getElementById('preview-label');

        if (zipFileInput && zipLabel) {
            zipFileInput.addEventListener('change', function() {
                zipLabel.textContent = this.files[0] ? this.files[0].name : 'Файл не вибрано';
            });
        }

        if (previewImgInput && previewLabel) {
            previewImgInput.addEventListener('change', function() {
                previewLabel.textContent = this.files[0] ? this.files[0].name : 'Файл не вибрано';
            });
        }
    };

    // Ініціалізація модулів після повного завантаження сторінки
    initDragAndDrop();
    initCatalogFilter();
    initStudentCheck();
    initBurgerMenu();
    initFileInputLabels();
});