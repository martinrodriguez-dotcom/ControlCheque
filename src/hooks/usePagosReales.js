// Conexión EXCLUSIVAMENTE DE LECTURA a la misma base usada por Pagos Avanzado.
// No importa reglas, autenticación ni funciones de escritura desde el módulo Pagos.
import { useEffect, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';

const firebaseConfigPagos = {
    apiKey: "AIzaSyDPOTn7fe_XSjrzSl1iOwZyump1KBLOVH4",
    authDomain: "listapagos.firebaseapp.com",
    projectId: "listapagos",
    storageBucket: "listapagos.firebasestorage.app",
    messagingSenderId: "618616599468",
    appId: "1:618616599468:web:633f250cf658bed8920009"
};

const APP_NAME = 'sii-pagos-avanzados-solo-lectura';
const pagosApp = getApps().some(app => app.name === APP_NAME)
    ? getApp(APP_NAME) : initializeApp(firebaseConfigPagos, APP_NAME);
const pagosDb = getFirestore(pagosApp);

export function usePagosReales(active = true) {
    const [state, setState] = useState({
        items: [], bancos: {}, loading: true, ready: false, error: '', bankError: ''
    });

    useEffect(() => {
        if (!active) return undefined;
        let live = true;
        const unsubCheques = onSnapshot(doc(pagosDb, 'finanzas', 'cheques'), snap => {
            if (!live) return;
            if (!snap.exists() || !Array.isArray(snap.data()?.data)) {
                setState(prev => ({...prev, items:[], loading:false, ready:false,
                    error:'La colección de Pagos no existe o no tiene el formato esperado; se omitieron cálculos.'}));
                return;
            }
            setState(prev => ({...prev, items:snap.data().data, loading:false, ready:true, error:''}));
        }, err => {
            if (!live) return;
            setState(prev => ({...prev, items:[], loading:false, ready:false,
                error:'No se pudieron leer los compromisos de Pagos: '+(err?.message||String(err))}));
        });
        const unsubBancos = onSnapshot(doc(pagosDb, 'finanzas', 'bancos'), snap => {
            if (!live) return;
            const data = snap.exists() ? snap.data()?.data : null;
            setState(prev => ({...prev, bancos:data && typeof data === 'object' ? data : {},bankError:''}));
        }, err => {
            if (live) setState(prev => ({...prev, bancos:{},bankError:'Sin información bancaria: '+(err?.message||String(err))}));
        });
        return () => {
            live=false;unsubCheques();unsubBancos();
        };
    }, [active]);

    return state;
}
