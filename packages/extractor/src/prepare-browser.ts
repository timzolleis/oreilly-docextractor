import axios, {AxiosResponse} from "axios";
import {parseCookie} from "./cookies.js";
import puppeteer from "puppeteer";
import ora from "ora";


async function sendAuthenticationRequest(institutionEmail: string) {
    return axios.post("https://www.oreilly.com/api/v1/registration/academic/", {
        email: institutionEmail
    })
}


function getJwtCookieHeader(response: AxiosResponse) {
    const setCookieHeader = response.headers["set-cookie"]
    const jwt = setCookieHeader.find((cookie: string) => cookie.startsWith("orm-jwt"))
    if (!jwt) {
        throw new Error("No JWT found")
    }
    return jwt
}

export async function authenticate(institutionEmail: string) {
    const response = await sendAuthenticationRequest(institutionEmail)
    const cookieHeader = getJwtCookieHeader(response)
    return parseCookie(cookieHeader)
}

export async function getAuthenticatedBrowserAndPage(institutionEmail: string) {
    const spinner = ora("Authenticating").start()
    const cookie = await authenticate(institutionEmail)
    const browser = await puppeteer.launch({headless: "new"});
    const page = await browser.newPage();
    await page.setCookie(cookie)
    spinner.succeed("Authenticated")
    return {browser, page}
}

