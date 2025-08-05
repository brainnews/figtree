javascript:(function(){'use strict';const FIGTREE_CONFIG={baseUrl: 'http://localhost:3000/',appScript: 'figtree-app.min.js',version: '2.0.0-bookmarklet'};if (window.FigtreeApp){window.FigtreeApp.toggle();return;}if (window.FigtreeLoading){return;}window.FigtreeLoading=true;const loadingIndicator=document.createElement('div');loadingIndicator.id='figtree-loading';loadingIndicator.innerHTML=`
<div style="
position: fixed;top: 20px;right: 20px;background: #2c2c2c;color: white;padding: 12px 16px;border-radius: 8px;font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size: 14px;z-index: 999999;box-shadow: 0 4px 12px rgba(0,0,0,0.3);display: flex;align-items: center;gap: 8px;">
<div style="
width: 16px;height: 16px;border: 2px solid #666;border-top: 2px solid #0D99FF;border-radius: 50%;animation: figtree-spin 1s linear infinite;"></div>
Loading Figtree...
</div>
<style>
@keyframes figtree-spin{0%{transform: rotate(0deg);}100%{transform: rotate(360deg);}}</style>
`;document.body.appendChild(loadingIndicator);const script=document.createElement('script');script.src=FIGTREE_CONFIG.baseUrl+FIGTREE_CONFIG.appScript;script.async=true;script.onload=function(){if (loadingIndicator) loadingIndicator.remove();window.FigtreeLoading=false;if (window.FigtreeApp){window.FigtreeApp.init();}else{console.error('[Figtree] App failed to load');showError('Failed to load Figtree app');}};script.onerror=function(){if (loadingIndicator) loadingIndicator.remove();window.FigtreeLoading=false;showError('Failed to load Figtree. Please check your internet connection.');};function showError(message){const errorDiv=document.createElement('div');errorDiv.innerHTML=`
<div style="
position: fixed;top: 20px;right: 20px;background: #FF3B30;color: white;padding: 12px 16px;border-radius: 8px;font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size: 14px;z-index: 999999;max-width: 300px;box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
${message}</div>
`;document.body.appendChild(errorDiv);setTimeout(()=>{if (errorDiv.parentNode) errorDiv.remove();},5000);}document.head.appendChild(script);})();