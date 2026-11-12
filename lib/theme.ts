export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "semesterfi-theme";

/** Runs in <head> before the first paint: the student's saved choice, else the device's setting. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
