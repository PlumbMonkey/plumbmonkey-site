document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('hero-video');
  const source = document.getElementById('hero-source');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');

  // --- VIDEO LOOP SWAP ---
  video.addEventListener('ended', function () {
    source.src = "assets/hero-loop.mp4";
    video.load();
    video.loop = true;
    video.muted = speakerBtn ? video.muted : true; // Respect mute toggle if set
    video.play();
  });

  // --- AUDIO TOGGLE BUTTON ---
  if (speakerBtn && iconMuted && iconUnmuted) {
    speakerBtn.addEventListener('click', () => {
      video.muted = !video.muted;
      video.play(); // Some browsers require a play() gesture to unmute

      if (video.muted) {
        iconMuted.classList.remove('hidden');
        iconUnmuted.classList.add('hidden');
      } else {
        iconMuted.classList.add('hidden');
        iconUnmuted.classList.remove('hidden');
      }
    });

    // Optional: update icon on initial load
    if (video.muted) {
      iconMuted.classList.remove('hidden');
      iconUnmuted.classList.add('hidden');
    } else {
      iconMuted.classList.add('hidden');
      iconUnmuted.classList.remove('hidden');
    }
  }
});
