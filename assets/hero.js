document.addEventListener('DOMContentLoaded', function () {
  const iframe = document.getElementById('hero-video');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // YouTube starts muted

  // --- AUDIO TOGGLE BUTTON (YouTube video) ---
  if (speakerBtn && iconMuted && iconUnmuted && iframe) {
    speakerBtn.addEventListener('click', () => {
      const currentSrc = iframe.src;
      
      if (isMuted) {
        // Switch to unmuted version
        iframe.src = currentSrc.replace('mute=1', 'mute=0');
        iconMuted.classList.add('hidden');
        iconUnmuted.classList.remove('hidden');
        isMuted = false;
      } else {
        // Switch to muted version
        iframe.src = currentSrc.replace('mute=0', 'mute=1');
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
