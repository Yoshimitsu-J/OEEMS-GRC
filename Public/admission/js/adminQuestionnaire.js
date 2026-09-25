/* =========================================
   ADMIN QUESTIONNAIRE — Working CRUD + Drag & Drop
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
  console.log('Admin Questionnaire JS Initialized.');

  // =========================================
  // STATE
  // =========================================
  let categories = ['Logical reasoning', 'Abstract', 'Filipino', 'English', 'Math'];

  let questionsByCategory = {
    'Logical reasoning': [
      {
        id: 'Q001LR',
        text: 'Which figure completes the series?',
        image: null,
        type: 'multiple-choice',
        options: [
          { text: 'A', correct: false },
          { text: 'B', correct: false },
          { text: 'C', correct: true },
          { text: 'D', correct: false }
        ]
      }
    ],
    'Abstract': [],
    'Filipino': [],
    'English': [],
    'Math': []
  };

  let currentCategory = 'Logical reasoning';
  let draggedIndex = null;

  // =========================================
  // DOM ELEMENTS
  // =========================================
  const categorySelect = document.getElementById('categorySelect');
  const newCategoryInput = document.getElementById('newCategoryInput');
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  const categoriesList = document.getElementById('categoriesList');
  const questionsContainer = document.getElementById('questionsContainer');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const saveChangesBtn = document.getElementById('saveChangesBtn');
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  const exportBtn = document.getElementById('exportBtn');
  const summaryContent = document.getElementById('summaryContent');
  const currentCategoryDisplay = document.getElementById('currentCategoryDisplay');

  // =========================================
  // LOAD FROM LOCALSTORAGE
  // =========================================
  const saved = localStorage.getItem('questionnaireData');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.categories) categories = data.categories;
      if (data.questionsByCategory) questionsByCategory = data.questionsByCategory;
      console.log('Loaded questionnaire from localStorage');
    } catch (e) {
      console.warn('Failed to load saved data:', e);
    }
  }

  // =========================================
  // RENDER CATEGORIES
  // =========================================
  function renderCategories() {
    categoriesList.innerHTML = '';

    categories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = cat === currentCategory ? 'active' : '';
      li.textContent = cat;

      li.addEventListener('click', () => {
        currentCategory = cat;
        categorySelect.value = cat;
        currentCategoryDisplay.textContent = cat;
        renderCategories();
        renderQuestions();
        renderSummary();
      });

      const defaultCats = ['Logical reasoning', 'Abstract', 'Filipino', 'English', 'Math'];
      if (!defaultCats.includes(cat)) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'q-cat-delete';
        deleteBtn.innerHTML = '<i class="bi bi-x"></i>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete category "${cat}"?`)) {
            categories = categories.filter((c) => c !== cat);
            delete questionsByCategory[cat];
            if (currentCategory === cat) {
              currentCategory = categories[0];
              currentCategoryDisplay.textContent = currentCategory;
            }
            renderCategories();
            renderQuestions();
            renderSummary();
          }
        });
        li.appendChild(deleteBtn);
      }

      categoriesList.appendChild(li);
    });

    categorySelect.innerHTML = '';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === currentCategory) opt.selected = true;
      categorySelect.appendChild(opt);
    });
  }

  // =========================================
  // RENDER QUESTIONS (with drag & drop)
  // =========================================
  function renderQuestions() {
    questionsContainer.innerHTML = '';
    const questions = questionsByCategory[currentCategory] || [];

    if (questions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'q-empty-state';
      empty.innerHTML = `
        <i class="bi bi-inbox"></i>
        <p>No questions yet for this category.</p>
        <p class="q-empty-hint">Click "+ Add Question" to start.</p>
      `;
      questionsContainer.appendChild(empty);
      renderSummary();
      return;
    }

    questions.forEach((q, qIndex) => {
      const card = document.createElement('div');
      card.className = 'q-card';
      card.draggable = true;                    // ✅ Enable drag
      card.dataset.index = qIndex;              // ✅ Store index
      card.dataset.id = q.id;

      // =========================================
      // DRAG EVENTS
      // =========================================
      card.addEventListener('dragstart', (e) => {
        draggedIndex = qIndex;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', qIndex);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.q-card').forEach((c) => {
          c.classList.remove('drag-over', 'drag-over-top', 'drag-over-bottom');
        });
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedIndex === null || draggedIndex === qIndex) return;

        // Determine if mouse is on top or bottom half
        const rect = card.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midpoint;

        // Clear previous indicators
        document.querySelectorAll('.q-card').forEach((c) => {
          c.classList.remove('drag-over-top', 'drag-over-bottom');
        });

        card.classList.add(isTopHalf ? 'drag-over-top' : 'drag-over-bottom');
      });

      card.addEventListener('dragleave', (e) => {
        card.classList.remove('drag-over-top', 'drag-over-bottom');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (draggedIndex === null || draggedIndex === qIndex) {
          document.querySelectorAll('.q-card').forEach((c) => {
            c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging');
          });
          return;
        }

        // Determine insert position
        const rect = card.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        const isTopHalf = e.clientY < midpoint;

        const questions = questionsByCategory[currentCategory];
        const [movedItem] = questions.splice(draggedIndex, 1);

        let newIndex = qIndex;
        if (draggedIndex < qIndex && !isTopHalf) newIndex = qIndex;
        else if (draggedIndex < qIndex && isTopHalf) newIndex = qIndex - 1;
        else if (draggedIndex > qIndex && isTopHalf) newIndex = qIndex;
        else newIndex = qIndex;

        questions.splice(newIndex, 0, movedItem);

        draggedIndex = null;
        renderQuestions();
        renderSummary();
      });

      // =========================================
      // HEADER
      // =========================================
      const header = document.createElement('div');
      header.className = 'q-card-header';
      header.innerHTML = `
        <div class="q-header-left">
          <span class="q-drag-handle" title="Drag to reorder">
            <i class="bi bi-grip-vertical"></i>
          </span>
          <span class="q-id">#${q.id}</span>
        </div>
        <div class="q-actions">
          <button class="q-icon-btn q-add-opt" title="Add option"><i class="bi bi-plus-circle"></i></button>
          <button class="q-icon-btn q-dup" title="Duplicate"><i class="bi bi-files"></i></button>
          <button class="q-icon-btn q-del" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      `;
      card.appendChild(header);

      // =========================================
      // QUESTION TEXT + IMAGE
      // =========================================
      const textRow = document.createElement('div');
      textRow.className = 'q-text-row';

      const textInput = document.createElement('input');
      textInput.type = 'text';
      textInput.className = 'q-input q-question-text';
      textInput.value = q.text;
      textInput.placeholder = 'Untitled Question';
      textInput.addEventListener('input', (e) => {
        q.text = e.target.value;
      });

      const imageBtn = document.createElement('button');
      imageBtn.className = 'q-icon-btn q-image-btn';
      imageBtn.title = 'Add image';
      imageBtn.innerHTML = '<i class="bi bi-image"></i>';
      imageBtn.addEventListener('click', () => {
        const url = prompt('Enter image URL:');
        if (url) {
          q.image = url;
          renderQuestions();
        }
      });

      const typeSpan = document.createElement('span');
      typeSpan.className = 'q-type-badge';
      typeSpan.innerHTML = '<i class="bi bi-circle"></i> Multiple Choice';

      textRow.appendChild(textInput);
      textRow.appendChild(imageBtn);
      textRow.appendChild(typeSpan);
      card.appendChild(textRow);

      // =========================================
      // QUESTION IMAGE PREVIEW
      // =========================================
      if (q.image) {
        const imgPreview = document.createElement('div');
        imgPreview.className = 'q-image-preview';
        imgPreview.innerHTML = `
          <img src="${q.image}" alt="Question image">
          <button class="q-remove-img" title="Remove image"><i class="bi bi-x"></i></button>
        `;
        imgPreview.querySelector('.q-remove-img').addEventListener('click', () => {
          q.image = null;
          renderQuestions();
        });
        card.appendChild(imgPreview);
      }

      // =========================================
      // OPTIONS
      // =========================================
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'q-options';

      q.options.forEach((opt, oIndex) => {
        const optRow = document.createElement('div');
        optRow.className = 'q-option-row';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = `correct-${q.id}`;
        radio.checked = opt.correct;
        radio.className = 'q-radio';
        radio.addEventListener('change', () => {
          q.options.forEach((o) => (o.correct = false));
          opt.correct = true;
        });

        const optInput = document.createElement('input');
        optInput.type = 'text';
        optInput.className = 'q-input q-option-input';
        optInput.value = opt.text;
        optInput.placeholder = `Option ${oIndex + 1}`;
        optInput.addEventListener('input', (e) => {
          opt.text = e.target.value;
        });

        const delOpt = document.createElement('button');
        delOpt.className = 'q-icon-btn q-del-opt';
        delOpt.title = 'Delete option';
        delOpt.innerHTML = '<i class="bi bi-x"></i>';
        delOpt.addEventListener('click', () => {
          if (q.options.length > 2) {
            q.options.splice(oIndex, 1);
            renderQuestions();
          } else {
            alert('Kailangan ng hindi bababa sa 2 options.');
          }
        });

        optRow.appendChild(radio);
        optRow.appendChild(optInput);
        optRow.appendChild(delOpt);
        optionsContainer.appendChild(optRow);
      });

      const addOptRow = document.createElement('div');
      addOptRow.className = 'q-add-option-row';
      addOptRow.innerHTML = '<i class="bi bi-plus-circle"></i> Add option';
      addOptRow.addEventListener('click', () => {
        q.options.push({ text: '', correct: false });
        renderQuestions();
      });
      optionsContainer.appendChild(addOptRow);

      card.appendChild(optionsContainer);

      // =========================================
      // HEADER BUTTONS
      // =========================================
      header.querySelector('.q-add-opt').addEventListener('click', (e) => {
        e.stopPropagation();
        q.options.push({ text: '', correct: false });
        renderQuestions();
      });

      header.querySelector('.q-dup').addEventListener('click', (e) => {
        e.stopPropagation();
        const copy = JSON.parse(JSON.stringify(q));
        copy.id = generateQuestionId(currentCategory);
        questionsByCategory[currentCategory].splice(qIndex + 1, 0, copy);
        renderQuestions();
      });

      header.querySelector('.q-del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete question #${q.id}?`)) {
          questionsByCategory[currentCategory].splice(qIndex, 1);
          renderQuestions();
          renderSummary();
        }
      });

      questionsContainer.appendChild(card);
    });

    renderSummary();
  }

  // =========================================
  // GENERATE QUESTION ID
  // =========================================
  function generateQuestionId(catName) {
    const prefix = catName.substring(0, 2).toUpperCase();
    const count = (questionsByCategory[catName] || []).length + 1;
    return `Q${String(count).padStart(3, '0')}${prefix}`;
  }

  // =========================================
  // RENDER SUMMARY
  // =========================================
  function renderSummary() {
    summaryContent.innerHTML = '';

    categories.forEach((cat) => {
      const questions = questionsByCategory[cat] || [];
      const totalItems = questions.length;
      const totalPoints = questions.length;
      const withPicture = questions.filter((q) => q.image).length;

      const block = document.createElement('div');
      block.className = 'q-summary-block';
      block.innerHTML = `
        <h4 class="q-summary-cat">${cat}</h4>
        <p>Items: <strong>${totalItems}</strong></p>
        <p>Total Points: <strong>${totalPoints}</strong></p>
        <p>With Picture: <strong>${withPicture}</strong></p>
      `;
      summaryContent.appendChild(block);
    });
  }

  // =========================================
  // ADD QUESTION
  // =========================================
  addQuestionBtn.addEventListener('click', () => {
    if (!questionsByCategory[currentCategory]) {
      questionsByCategory[currentCategory] = [];
    }

    const newQ = {
      id: generateQuestionId(currentCategory),
      text: '',
      image: null,
      type: 'multiple-choice',
      options: [
        { text: 'Option 1', correct: false },
        { text: 'Option 2', correct: false }
      ]
    };

    questionsByCategory[currentCategory].push(newQ);
    renderQuestions();

    setTimeout(() => {
      questionsContainer.scrollTop = questionsContainer.scrollHeight;
    }, 100);
  });

  // =========================================
  // ADD CATEGORY
  // =========================================
  addCategoryBtn.addEventListener('click', () => {
    const name = newCategoryInput.value.trim();
    if (!name) {
      alert('Please enter a category name.');
      return;
    }
    if (categories.includes(name)) {
      alert('Category already exists.');
      return;
    }

    categories.push(name);
    questionsByCategory[name] = [];
    newCategoryInput.value = '';
    currentCategory = name;
    currentCategoryDisplay.textContent = name;
    renderCategories();
    renderQuestions();
    renderSummary();
  });

  newCategoryInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addCategoryBtn.click();
  });

  // =========================================
  // CATEGORY SELECT CHANGE
  // =========================================
  categorySelect.addEventListener('change', (e) => {
    currentCategory = e.target.value;
    currentCategoryDisplay.textContent = currentCategory;
    renderCategories();
    renderQuestions();
    renderSummary();
  });

  // =========================================
  // SAVE CHANGES
  // =========================================
  saveChangesBtn.addEventListener('click', () => {
    const data = {
      categories,
      questionsByCategory,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('questionnaireData', JSON.stringify(data));
    alert('✅ Questionnaire saved successfully!');
    console.log('Saved:', data);
  });

  // =========================================
  // EXPORT JSON
  // =========================================
  exportBtn.addEventListener('click', () => {
    const data = {
      categories,
      questionsByCategory,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionnaire_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // =========================================
  // IMPORT JSON
  // =========================================
  importBtn.addEventListener('click', () => importFile.click());

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.categories && data.questionsByCategory) {
          categories = data.categories;
          questionsByCategory = data.questionsByCategory;
          currentCategory = categories[0];
          currentCategoryDisplay.textContent = currentCategory;
          renderCategories();
          renderQuestions();
          renderSummary();
          alert('✅ Imported successfully!');
        } else {
          alert('Invalid JSON format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
        console.error(err);
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  // =========================================
  // INITIAL RENDER
  // =========================================
  renderCategories();
  renderQuestions();
  renderSummary();
});