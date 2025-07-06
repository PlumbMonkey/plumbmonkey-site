document.addEventListener('DOMContentLoaded', function () {
  const intro = document.getElementById('hero-intro');
  const loop = document.getElementById('hero-loop');
  console.log('Loaded:', { intro, loop });

  if (intro && loop) {
    intro.addEventListener('ended', () => {
      console.log('Intro ended, switching to loop video...');
      intro.classList.add('hidden');
      loop.classList.remove('hidden');
      setTimeout(() => {
        const playPromise = loop.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => console.log('Loop video playing!'))
            .catch(e => console.error('Loop video failed to play:', e));
        } else {
          console.log('Loop play() returned undefined (possibly already playing)');
        }
      }, 100);
    });
  } else {
    console.warn('Could not find intro or loop video elements!');
  }
});

