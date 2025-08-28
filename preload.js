(function(){
  try{
    const params = new URLSearchParams(location.search);
    const uploaded = params.get('uploaded') === '1';
    if(!uploaded) return;
    const raw = localStorage.getItem('quiz-upload');
    if(!raw) return;
    let dataScript = document.getElementById('data');
    if(!dataScript){
      dataScript = document.createElement('script');
      dataScript.id = 'data';
      dataScript.type = 'application/json';
      document.body.appendChild(dataScript);
    }
    dataScript.textContent = raw;
  }catch(e){
    console.warn('preload.js: no se pudo inyectar datos cargados', e);
  }
})();