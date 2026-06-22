(async () => {
  const params = new URLSearchParams(location.search);
  const action = params.get('action');
  const project = params.get('project');

  if (!action) { window.close(); return; }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'CLI_COMMAND',
      command: action === 'list'
        ? { action: 'list' }
        : { action, projectName: project ?? '' },
    });

    if (action === 'list' && response && response.ok) {
      const pre = document.createElement('pre');
      pre.textContent = JSON.stringify(response.data, null, 2);
      document.body.replaceChildren(pre);
      document.body.classList.add('show');
      return;
    }

    if (response && !response.ok) {
      const pre = document.createElement('pre');
      pre.textContent = `Error: ${response.error}`;
      document.body.replaceChildren(pre);
      document.body.classList.add('show');
      return;
    }
  } catch {
    // Extension context may not be available
  }

  window.close();
})();
