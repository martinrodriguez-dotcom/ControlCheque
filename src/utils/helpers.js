// Archivo: src/utils/helpers.js

export const getDays = (date) => { 
    if (!date) return 999; 
    return Math.ceil((new Date(date+'T00:00:00') - new Date().setHours(0,0,0,0)) / (86400000)); 
};

export const formatMoney = (val) => {
    return new Intl.NumberFormat('es-AR', { 
        style: 'currency', 
        currency: 'ARS', 
        minimumFractionDigits: 0 
    }).format(val || 0);
};

export const formatDate = (dateStr) => { 
    if(!dateStr) return '-'; 
    const date = new Date(dateStr + 'T00:00:00'); 
    return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }); 
};

export const getCategoryLabel = (cat) => {
    const map = { 
        'raw': 'Materia Prima', 
        'logistics': 'Logística', 
        'taxes': 'Impuestos', 
        'salaries': 'Sueldos', 
        'services': 'Servicios', 
        'maintenance': 'Mantenimiento', 
        'others': 'Otros' 
    };
    return map[cat] || 'Otros';
};

export const getCategoryColor = (cat) => {
    const map = { 
        'raw': 'bg-blue-500', 
        'logistics': 'bg-orange-500', 
        'taxes': 'bg-red-500', 
        'salaries': 'bg-green-500', 
        'services': 'bg-purple-500', 
        'maintenance': 'bg-yellow-500', 
        'others': 'bg-gray-400' 
    };
    return map[cat] || 'bg-gray-400';
};

export const getTheme = (mode) => {
    if(mode === 'pay') return { main: 'blue', bg: 'bg-blue-800', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-500', btn: 'bg-blue-600' };
    if(mode === 'collect') return { main: 'emerald', bg: 'bg-emerald-800', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-500', btn: 'bg-emerald-600' };
    if(mode === 'wallet') return { main: 'indigo', bg: 'bg-indigo-800', light: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-500', btn: 'bg-indigo-600' };
    if(mode === 'expenses') return { main: 'orange', bg: 'bg-orange-800', light: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-500', btn: 'bg-orange-600' };
    if(mode === 'cashbox') return { main: 'cyan', bg: 'bg-cyan-800', light: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-500', btn: 'bg-cyan-600' };
    if(mode === 'pallets') return { main: 'teal', bg: 'bg-teal-800', light: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-500', btn: 'bg-teal-600' };
    if(mode === 'billing') return { main: 'pink', bg: 'bg-pink-800', light: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-500', btn: 'bg-pink-600' };
    return { main: 'violet', bg: 'bg-violet-900', light: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-500', btn: 'bg-violet-600' }; 
};

export const handleReportAction = (title, bodyContent, action, filename) => {
    const reportCSS = `
        body, .report-container { font-family: sans-serif; padding: 20px; color: #333; font-size: 11px; position: relative; background: #fff; }
        h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 5px; font-size: 16px; margin-bottom: 5px; width: 80%; }
        .meta { color: #666; font-size: 9px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; }
        th { background: #e5e7eb; padding: 6px; text-align: left; font-size: 11px; border-bottom: 1px solid #999; font-weight: bold; }
        td { padding: 6px; border-bottom: 1px solid #eee; vertical-align: top; }
        .group-row td { background: #e5e7eb; font-weight: bold; padding: 4px; font-size: 11px; border-top: 1px solid #ccc; }
        .amount { font-family: monospace; text-align: right; font-weight: bold; }
        .date { white-space: nowrap; }
        .center { text-align: center; }
        .red { color: #dc2626; font-weight: bold; }
        .green { color: #16a34a; font-weight: bold; }
        .blue { color: #2563eb; font-weight: bold; }
        .green-acum { color: #16a34a; font-weight: bold; }
        .red-acum { color: #dc2626; font-weight: bold; }
        .total-box { padding: 8px; background: #f0f9ff; border: 1px solid #bae6fd; margin-bottom: 10px; border-radius: 4px; font-weight: bold; font-size: 12px; }
        .client-info { background: #f3f4f6; padding: 10px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #e5e7eb; }
        .client-name { font-size: 16px; font-weight: bold; color: #111; }
        .total-row td { border-top: 2px solid #333; font-size: 14px; background: #fff; padding-top: 10px; font-weight: bold; }
        .desc-col { text-align: left; width: 60%; font-size: 10px; color: #555; }
        .desc-item { display: block; margin-bottom: 2px; }
        .desc-item span { color: #888; font-size: 9px; margin-left: 4px; }
    `;

    if (action === 'print') {
        const htmlString = `<html><head><title>${title}</title><style>${reportCSS}</style></head><body><div class="report-container">${bodyContent}</div></body></html>`;
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlString);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { 
                printWindow.print(); 
            }, 500);
        } else {
            alert("Por favor, permite las ventanas emergentes (pop-ups) en tu navegador para imprimir.");
        }
    } else if (action === 'download') {
        if (typeof window.html2pdf === 'undefined') {
            alert("La librería de PDF se está cargando. Por favor, espera un momento y vuelve a intentar.");
            return;
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<style>${reportCSS}</style><div class="report-container">${bodyContent}</div>`;
        
        tempDiv.style.position = 'fixed'; 
        tempDiv.style.left = '0px'; 
        tempDiv.style.top = '0px'; 
        tempDiv.style.width = '800px'; 
        tempDiv.style.backgroundColor = 'white';
        tempDiv.style.zIndex = '-9999';
        tempDiv.style.opacity = '0';
        tempDiv.style.pointerEvents = 'none';
        
        document.body.appendChild(tempDiv);
        
        const opt = { 
            margin: 10, 
            filename: filename + '.pdf', 
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { scale: 2, useCORS: true, logging: false }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
        };
        
        setTimeout(() => {
            window.html2pdf().set(opt).from(tempDiv).save().then(() => { 
                document.body.removeChild(tempDiv); 
            }).catch(err => { 
                console.error(err); 
                document.body.removeChild(tempDiv); 
                alert("Error al generar PDF."); 
            });
        }, 300);
    }
};
