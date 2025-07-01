// This file is loaded by the index.html file and runs in the renderer process.

console.log('Renderer Process is working!');

// You can add code here to interact with the DOM, for example:
window.addEventListener('DOMContentLoaded', () => {
  const header = document.querySelector('h1');
  if (header) {
    header.textContent = 'Adjutant - Hello World!';
  }
});
