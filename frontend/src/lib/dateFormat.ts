/** Fixed locale — the app is English-only for now. */

export const APP_LOCALE = "en-US";



const APP_TIME_DEFAULTS: Intl.DateTimeFormatOptions = {

  hour12: false,

};



const CHART_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {

  month: "short",

  day: "numeric",

  hour: "2-digit",

  minute: "2-digit",

  hour12: false,

};



export function formatAppDate(

  date: Date,

  options?: Intl.DateTimeFormatOptions,

): string {

  return date.toLocaleDateString(APP_LOCALE, options);

}



export function formatAppTime(

  date: Date,

  options?: Intl.DateTimeFormatOptions,

): string {

  return date.toLocaleTimeString(APP_LOCALE, { ...APP_TIME_DEFAULTS, ...options });

}



export function formatAppDateTime(

  date: Date,

  options?: Intl.DateTimeFormatOptions,

): string {

  return date.toLocaleString(APP_LOCALE, { ...APP_TIME_DEFAULTS, ...options });

}



export function formatAppChartDateTime(date: Date): string {

  return formatAppDateTime(date, CHART_DATETIME_OPTIONS);

}


