document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('hero-video');
  const source = document.getElementById('hero-source');

  video.addEventListener('ended', function () {
    // Swap in looping background video after intro
    source.src = "assets/hero-loop.mp4";
    video.load();
    video.loop = true;
    video.play();
  });
});

