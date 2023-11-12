import {Cookie} from "./cookie-class.js";


export function parseCookie(cookieString: string) {
    const parts = cookieString.split(';').map(part => part.trim());
    const pair = parts[0].split('=');
    const cookie = new Cookie();
    cookie.name = pair[0];
    cookie.value = pair[1];
    cookie.size = cookieString.length;
    cookie.httpOnly = false;
    cookie.secure = false;
    cookie.session = true;
    cookie.url = "";
    parts.slice(1).forEach(part => {
        const [key, value] = part.split('=');
        switch (key.toLowerCase()) {
            case 'domain':
                cookie.domain = `.${value}`;
                break;
            case 'path':
                cookie.path = value;
                break;
            case 'expires':
                cookie.expires = new Date(value).getTime() / 1000;
                break;
            case 'max-age':
                cookie.expires = Date.now() + parseInt(value) * 1000;
                break;
            case 'secure':
                cookie.secure = true;
                break;

        }
    });
    cookie.sameSite = "Lax";
    return cookie;
}