document.addEventListener('DOMContentLoaded', function () {
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // Audio starts muted

  // --- AUDIO TOGGLE BUTTON (for future video implementation) ---
  if (speakerBtn && iconMuted && iconUnmuted) {
    speakerBtn.addEventListener('click', () => {
      if (isMuted) {
        // Unmute
        iconMuted.classList.add('hidden');
        iconUnmuted.classList.remove('hidden');
        isMuted = false;
      } else {
        // Mute
        iconMuted.classList.remove('hidden');
        iconUnmuted.classList.add('hidden');
        isMuted = true;
      }
    });

    // Set initial icon state (muted by default)
    iconMuted.classList.remove('hidden');
    iconUnmuted.classList.add('hidden');
  }
});
