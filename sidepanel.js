document.addEventListener('DOMContentLoaded', function() {
  const noteArea = document.getElementById('note-area');
  const saveButton = document.getElementById('save-button');
  const cancelButton = document.getElementById('cancel-button');
  const closePanel = document.getElementById('close-panel');
  const toggleContextButton = document.getElementById('toggle-context');
  const contextContent = document.getElementById('context-content');
  const opacityBtn = document.getElementById('opacity-btn');
  const floatingPanel = document.getElementById('floating-panel');
  const dragHandle = document.getElementById('drag-handle');
  
  let pageContext = null;
  let currentOpacity = 95;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  // Opacity control
  function updateOpacity(opacity) {
    currentOpacity = opacity;
    document.documentElement.style.setProperty('--panel-opacity', opacity / 100);
    opacityBtn.textContent = `🔍 ${opacity}%`;
    localStorage.setItem('panelOpacity', opacity);
  }

  // Load saved opacity
  const savedOpacity = localStorage.getItem('panelOpacity');
  if (savedOpacity) {
    updateOpacity(parseInt(savedOpacity));
  }

  // Opacity controls
  opacityBtn.addEventListener('click', function() {
    const opacities = [95, 85, 75, 65, 55];
    const currentIndex = opacities.indexOf(currentOpacity);
    const nextIndex = (currentIndex + 1) % opacities.length;
    updateOpacity(opacities[nextIndex]);
  });

  // Dragging functionality
  dragHandle.addEventListener('mousedown', function(e) {
    isDragging = true;
    const rect = floatingPanel.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
    e.preventDefault();
  });

  function handleDrag(e) {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    floatingPanel.style.left = Math.max(0, Math.min(window.innerWidth - floatingPanel.offsetWidth, x)) + 'px';
    floatingPanel.style.top = Math.max(0, Math.min(window.innerHeight - floatingPanel.offsetHeight, y)) + 'px';
    floatingPanel.style.right = 'auto';
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
  }

  // Initialize panel with page context
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getPageContent' }, function(response) {
        if (response) {
          setupPageContext(response);
        }
      });
    }
  });

  function setupPageContext(response) {
    pageContext = {
      title: response.title,
      url: response.url,
      summary: response.summary || '',
      domain: new URL(response.url).hostname,
      isYouTube: response.isYouTube || false,
      youtube: response.youtube || null
    };
    
    // Display context
    document.getElementById('page-title').textContent = response.title;
    document.getElementById('page-url').textContent = response.url;
    
    // Make URL clickable
    document.getElementById('page-url').addEventListener('click', () => {
      chrome.tabs.create({ url: response.url });
    });
    
    // Show summary if available
    const summaryElement = document.getElementById('page-summary');
    if (response.summary && response.summary.trim()) {
      summaryElement.textContent = response.summary;
      summaryElement.style.display = 'block';
    }
    
    // Handle YouTube-specific content
    if (response.isYouTube && response.youtube) {
      setupYouTubeContext(response.youtube);
    }
    
    // Check for related notes
    checkRelatedNotes(response.url);
  }

  function setupYouTubeContext(youtube) {
    const videoInfoElement = document.getElementById('video-info');
    const videoTitleElement = document.getElementById('video-title');
    const videoTimeElement = document.getElementById('video-time');
    const timestampedUrlElement = document.getElementById('timestamped-url');
    
    videoTitleElement.textContent = youtube.videoTitle;
    videoTimeElement.textContent = `⏰ Current time: ${youtube.timeString} • 📺 ${youtube.channelName}`;
    
    if (youtube.timestampedUrl) {
      timestampedUrlElement.textContent = `🔗 Open at ${youtube.timeString}`;
      timestampedUrlElement.addEventListener('click', () => {
        chrome.tabs.create({ url: youtube.timestampedUrl });
      });
    }
    
    videoInfoElement.style.display = 'block';
    
    // Auto-pause video
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'pauseVideo' });
      }
    });
  }

  function checkRelatedNotes(url) {
    chrome.storage.local.get({ notes: [] }, function(result) {
      const notes = result.notes;
      const domain = new URL(url).hostname;
      const exactUrlNotes = notes.filter(note => (note.metadata?.url || note.url) === url);
      const sameWebsiteNotes = notes.filter(note => {
        const noteUrl = note.metadata?.url || note.url;
        return noteUrl && new URL(noteUrl).hostname === domain && noteUrl !== url;
      });
      
      if (exactUrlNotes.length > 0 || sameWebsiteNotes.length > 0) {
        const relatedElement = document.getElementById('related-notes');
        let relatedText = '';
        
        if (exactUrlNotes.length > 0) {
          relatedText += `📝 ${exactUrlNotes.length} note(s) from this page`;
        }
        if (sameWebsiteNotes.length > 0) {
          if (relatedText) relatedText += ' • ';
          relatedText += `🌐 ${sameWebsiteNotes.length} note(s) from ${domain}`;
        }
        
        relatedElement.textContent = relatedText;
        relatedElement.style.display = 'block';
      }
    });
  }

  // Toggle context visibility
  toggleContextButton.addEventListener('click', function() {
    if (contextContent.style.display === 'none') {
      contextContent.style.display = 'block';
      toggleContextButton.textContent = 'Hide';
    } else {
      contextContent.style.display = 'none';
      toggleContextButton.textContent = 'Show';
    }
  });

  // Close panel
  closePanel.addEventListener('click', function() {
    window.close();
  });

  // Cancel button
  cancelButton.addEventListener('click', function() {
    // Resume video if YouTube
    if (pageContext?.isYouTube) {
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: 'resumeVideo' });
        }
      });
    }
    window.close();
  });

  // Enhanced save functionality with background categorization
  function saveNoteAndClose() {
    const noteText = noteArea.value.trim();
    if (!noteText) {
      noteArea.focus();
      return;
    }

    // Show progress
    showStatus('💾 Saving note...', true);
    saveButton.disabled = true;
    cancelButton.disabled = true;

    // Send note to background for processing
    chrome.runtime.sendMessage({
      action: 'saveNote',
      data: {
        content: noteText,
        metadata: pageContext
      }
    }, function(response) {
      if (response && response.status === 'success') {
        showStatus('✅ Note saved!', false);
        
        // Resume video if YouTube
        if (pageContext?.isYouTube) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
              chrome.tabs.sendMessage(tabs[0].id, { action: 'resumeVideo' });
            }
          });
        }
        
        // Close panel after brief delay
        setTimeout(() => {
          window.close();
        }, 800);
      } else {
        showStatus('❌ Failed to save note', false);
        saveButton.disabled = false;
        cancelButton.disabled = false;
      }
    });
  }

  function showStatus(text, showProgress) {
    const statusSection = document.getElementById('status-section');
    const statusText = document.getElementById('status-text');
    const progressBar = document.getElementById('progress-bar');
    
    statusText.textContent = text;
    statusSection.style.display = 'block';
    
    if (showProgress) {
      progressBar.style.display = 'block';
      // Animate progress bar
      const progressFill = document.getElementById('progress-fill');
      let width = 0;
      const interval = setInterval(() => {
        width += 10;
        progressFill.style.width = width + '%';
        if (width >= 90) clearInterval(interval);
      }, 100);
    } else {
      progressBar.style.display = 'none';
    }
  }

  // Save button click
  saveButton.addEventListener('click', saveNoteAndClose);

  // Enter key to save
  noteArea.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      saveNoteAndClose();
    }
  });

  // Focus on textarea when panel opens
  setTimeout(() => {
    noteArea.focus();
  }, 100);
});