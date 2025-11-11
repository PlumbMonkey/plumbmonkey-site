document.addEventListener('DOMContentLoaded', function () {
  const iframe = document.getElementById('hero-video');
  const posterImg = document.getElementById('hero-poster');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // YouTube starts muted

  // --- VIDEO END DETECTION (YouTube iframe) ---
  // YouTube iframe onStateChange via postMessage API
  if (iframe) {
    window.addEventListener('message', (event) => {
      // Simple check: if the video finishes, hide iframe and show poster
      if (event.data && event.data.info && event.data.info === 0) {
        // State 0 = ENDED
        setTimeout(() => {
          if (iframe) iframe.classList.add('hidden');
          if (posterImg) posterImg.classList.remove('hidden');
          if (speakerBtn) speakerBtn.classList.add('hidden'); // Hide speaker button when poster shows
        }, 100);
      }
    });
  }

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
