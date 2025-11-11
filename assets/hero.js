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
    // Add debugging info
    console.log('Video element found:', video);
    console.log('Video sources:', video.querySelectorAll('source'));
    
    // Check each source URL
    const sources = video.querySelectorAll('source');
    sources.forEach((source, index) => {
      console.log(`Source ${index + 1}: ${source.src}`);
      
      // Test if the video file is actually accessible
      fetch(source.src, { method: 'HEAD' })
        .then(response => {
          console.log(`Source ${index + 1} HTTP status:`, response.status);
          console.log(`Source ${index + 1} Content-Type:`, response.headers.get('Content-Type'));
          console.log(`Source ${index + 1} Content-Length:`, response.headers.get('Content-Length'));
        })
        .catch(error => {
          console.error(`Source ${index + 1} fetch error:`, error);
        });
    });
    
    // Show fallback image if video fails to load
    video.addEventListener('error', (e) => {
      console.error('Video failed to load:', e);
      video.classList.add('hidden');
      fallbackImage.classList.remove('hidden');
      // Hide speaker button if no video
      if (speakerBtn) speakerBtn.classList.add('hidden');
    });

    // Check if video can play
    video.addEventListener('canplay', () => {
      console.log('Video can start playing');
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

    // Try to force video load
    video.load();
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
