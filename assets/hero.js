document.addEventListener('DOMContentLoaded', function () {
  const video = document.getElementById('hero-video');
  const fallbackImage = document.getElementById('hero-fallback');
  const speakerBtn = document.getElementById('speaker-btn');
  const iconMuted = document.getElementById('icon-muted');
  const iconUnmuted = document.getElementById('icon-unmuted');
  
  let isMuted = true; // Video starts muted
  let isVideoPlaying = false;

  // --- VIDEO FALLBACK HANDLING ---
  if (video && fallbackImage) {
    // Show fallback image if video fails to load
    video.addEventListener('error', () => {
      console.log('Video failed to load, showing fallback image');
      video.classList.add('hidden');
      fallbackImage.classList.remove('hidden');
      // Hide speaker button if no video
      if (speakerBtn) speakerBtn.classList.add('hidden');
    });

    // Hide fallback when video loads and starts playing
    video.addEventListener('loadeddata', () => {
      console.log('Video loaded successfully');
      fallbackImage.classList.add('hidden');
      video.classList.remove('hidden');
      isVideoPlaying = true;
    });

    // Show fallback if video pauses/ends
    video.addEventListener('pause', () => {
      if (isVideoPlaying) {
        console.log('Video paused, showing fallback image');
        fallbackImage.classList.remove('hidden');
      }
    });

    // Hide fallback when video resumes
    video.addEventListener('play', () => {
      console.log('Video playing, hiding fallback image');
      fallbackImage.classList.add('hidden');
      isVideoPlaying = true;
    });
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
