document.addEventListener('DOMContentLoaded', function () {
  const intro = document.getElementById('hero-intro');
  const loop = document.getElementById('hero-loop');
  if (intro && loop) {
    intro.addEventListener('ended', () => {
      intro.classList.add('hidden');
      loop.classList.remove('hidden');
      loop.play();
    });
  }
});
