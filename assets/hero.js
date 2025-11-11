// Load YouTube IFrame API
const tag = document.createElement('script');
tag.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(tag);

let player;

// Called when YouTube IFrame API is ready
function onYouTubeIframeAPIReady() {
  const iframeElement = document.getElementById('hero-video');
  
  if (iframeElement) {
    player = new YT.Player('hero-video', {
      events: {
        'onStateChange': onPlayerStateChange
      }
    });
  }
}

// Handle video state changes (0=ended, 1=playing, 2=paused, 3=buffering, 5=unstarted)
function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.ENDED) {
    // Video finished - hide iframe, show poster
    const iframe = document.getElementById('hero-video');
    const posterImg = document.getElementById('hero-poster');
    const speakerBtn = document.getElementById('speaker-btn');
    
    if (iframe) iframe.classList.add('hidden');
    if (posterImg) posterImg.classList.remove('hidden');
    if (speakerBtn) speakerBtn.classList.add('hidden');
  }
}

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
