document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('hero-video');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // Video starts muted

  // --- AUDIO TOGGLE BUTTON ---
  if (speakerBtn && iconMuted && iconUnmuted && video) {
    speakerBtn.addEventListener('click', () => {
      if (isMuted) {
        // Unmute the video
        video.muted = false;
        iconMuted.classList.add('hidden');
        iconUnmuted.classList.remove('hidden');
        isMuted = false;
      } else {
        // Mute the video
        video.muted = true;
        iconMuted.classList.remove('hidden');
        iconUnmuted.classList.add('hidden');
        isMuted = true;
      }
    });

    // Set initial icon state (muted by default)
    iconMuted.classList.remove('hidden');
    iconUnmuted.classList.add('hidden');
    
    // Ensure video starts muted
    video.muted = true;
  }
});
