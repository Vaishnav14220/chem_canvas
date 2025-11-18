export function loadJmol() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('SCRIPT')
        script.onload = () => resolve(window.Jmol)
        script.onerror = reject
        script.src = 'http://jmol.sourceforge.net/jmol/JSmol.min.js'
        document.head.appendChild(script)
    })
}