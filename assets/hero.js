document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('hero-video');
  const fallbackImage = document.getElementById('hero-fallback');
  const playButton = document.getElementById('play-button');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // Video starts muted
  let isVideoPlaying = false;

  // --- VIDEO FALLBACK HANDLING ---
  if (video && fallbackImage) {
    // Try to load and play video on page load
    setTimeout(() => {
      video.load();
      video.play().then(() => {
        console.log('Video started playing automatically');
        fallbackImage.classList.add('hidden');
        playButton.classList.add('hidden');
        isVideoPlaying = true;
      }).catch(e => {
        console.log('Autoplay blocked, showing play button');
        playButton.classList.remove('hidden');
      });
    }, 500);

    video.addEventListener('loadeddata', () => {
      console.log('Video data loaded');
    });

    video.addEventListener('ended', () => {
      console.log('Video finished playing, showing poster image');
      video.classList.add('hidden');
      fallbackImage.classList.remove('hidden');
      playButton.classList.remove('hidden');
      isVideoPlaying = false;
    });

    video.addEventListener('error', () => {
      console.log('Video failed to load');
      playButton.classList.add('hidden');
    });

    // Play button click handler
    if (playButton) {
      playButton.addEventListener('click', () => {
        video.play().then(() => {
          fallbackImage.classList.add('hidden');
          playButton.classList.add('hidden');
          isVideoPlaying = true;
        });
      });
    }
  }

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
