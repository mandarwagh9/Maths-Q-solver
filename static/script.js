// DOM Elements
const textTab = document.getElementById('textTab');
const imageTab = document.getElementById('imageTab');
const textInput = document.getElementById('textInput');
const imageInput = document.getElementById('imageInput');
const problemText = document.getElementById('problemText');
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const solveButton = document.getElementById('solveButton');
const errorMessage = document.getElementById('errorMessage');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultSection = document.getElementById('resultSection');
const problemResult = document.getElementById('problemResult');
const solutionResult = document.getElementById('solutionResult');

// Variables
let currentTab = 'text';
let selectedFile = null;

// Event Listeners
textTab.addEventListener('click', () => switchTab('text'));
imageTab.addEventListener('click', () => switchTab('image'));
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
dropzone.addEventListener('dragover', handleDragOver);
dropzone.addEventListener('drop', handleDrop);
solveButton.addEventListener('click', solveProblem);

// Functions
function switchTab(tab) {
  currentTab = tab;

  if (tab === 'text') {
    textTab.classList.add('active');
    imageTab.classList.remove('active');
    textInput.classList.remove('hidden');
    imageInput.classList.add('hidden');
  } else {
    textTab.classList.remove('active');
    imageTab.classList.add('active');
    textInput.classList.add('hidden');
    imageInput.classList.remove('hidden');
  }

  hideError();
  resultSection.style.display = 'none';
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    processSelectedFile(file);
  }
}

function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    processSelectedFile(file);
  }
}

function processSelectedFile(file) {
  if (!file.type.match('image.*')) {
    showError('Please upload an image file');
    return;
  }
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    imagePreview.src = e.target.result;
    imagePreview.style.display = 'block';
  };
  reader.readAsDataURL(file);
  hideError();
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

function hideError() {
  errorMessage.style.display = 'none';
}

async function solveProblem() {
  hideError();

  if (currentTab === 'text') {
    if (!problemText.value.trim()) {
      showError('Please enter a math problem');
      return;
    }
  } else {
    if (!selectedFile) {
      showError('Please upload an image');
      return;
    }
  }

  loadingIndicator.style.display = 'block';
  solveButton.disabled = true;

  try {
    let problem = '';
    if (currentTab === 'text') {
      problem = problemText.value.trim();
    }
    // For image input, the problem text is extracted on the server

    const response = await sendToBackend(problem, currentTab);
    displayResults(problem, response);
  } catch (error) {
    showError(error.message || 'An error occurred. Please try again.');
  } finally {
    loadingIndicator.style.display = 'none';
    solveButton.disabled = false;
  }
}

async function sendToBackend(problem, inputType) {
  try {
    const formData = new FormData();
    formData.append('problem', problem);
    formData.append('input_type', inputType);
    if (inputType === 'image') {
      formData.append('file', selectedFile);
    }
    const response = await fetch('/solve', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server error');
    }
    return await response.json();
  } catch (error) {
    throw new Error('Failed to communicate with the server: ' + error.message);
  }
}

function displayResults(problem, solution) {
  problemResult.textContent = problem;

  let solutionHtml = '';
  if (solution.steps && solution.steps.length > 0) {
    solutionHtml += '<p><strong>Steps:</strong></p>';
    solutionHtml += '<ol>';
    solution.steps.forEach((step) => {
      solutionHtml += `<li>${step}</li>`;
    });
    solutionHtml += '</ol>';
  }

  if (solution.result) {
    solutionHtml += `<p><strong>Answer:</strong> ${solution.result}</p>`;
  } else if (solution.solution) {
    solutionHtml += `<p>${solution.solution}</p>`;
  }

  solutionResult.innerHTML = solutionHtml;
  resultSection.style.display = 'block';
  resultSection.scrollIntoView({ behavior: 'smooth' });

  // Trigger MathJax to render any LaTeX math expressions in the output
  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}
