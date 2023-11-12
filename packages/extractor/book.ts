import {configDotenv} from "dotenv";
import {getAuthenticatedBrowserAndPage} from "./prepare-browser";
import {Page} from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import PDFMerger = require("pdf-merger-js");


async function visitBookUrl(url: string, page: Page) {
    await page.goto(url, {waitUntil: 'networkidle0'})
}

async function getNextPageUrl(page: Page) {
    const xPath = "/html/body/div/main/section/div/nav/section/div[3]/a"
    const element = await page.$x(xPath).then(elements => elements?.[0])
    if (!element) {
        return null
    }
    return page.evaluate((el: HTMLAnchorElement) => el.href, element);
}


export async function indexPages(bookName: string, bookUrl: string) {
    const {browser, page} = await getAuthenticatedBrowserAndPage(process.env.INSTITUTION_EMAIL);
    const visitedUrls: string[] = [];
    let hasNextElement = true;
    //Visit the URL initially
    await visitBookUrl(bookUrl, page)
    while (hasNextElement) {
        const nextPageUrl = await getNextPageUrl(page)
        if (!nextPageUrl) {
            hasNextElement = false
            break;
        }
        console.log("Indexing page", nextPageUrl)
        visitedUrls.push(nextPageUrl)
        await visitBookUrl(nextPageUrl, page)
    }
    //Write it to a file
    const dirPath = path.join("..", "indexed-books")
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true})
    }
    const filePath = path.join(dirPath, `${bookName}-pages.json`)
    fs.writeFileSync(filePath, JSON.stringify(visitedUrls))
    console.log("Indexed book pages successfully")
    await browser.close()
}


async function addPrintStyles(browserPage: Page) {
    await browserPage.addStyleTag({
        content: `
                p, h1, h2, h3, h4, h5, h6, div {
                    break-inside: avoid;
                    hyphens: manual;
                }
                @page {
                    size: A4;
                    margin: 100px 50px;
                }
            `,
    });
}

async function removeElements(browserPage: Page, xPath: string) {
    const elements = await browserPage.$x(xPath);
    if (elements.length > 0) {
        await browserPage.evaluate((el: HTMLElement) => el.remove(), elements[0]);
    }
}

async function capturePdf(browserPage: Page, name: string, bookName: string) {
    const dirPath = path.join("..", "captured-books", bookName)
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true})
    }
    const pdf = await browserPage.pdf({
        path: path.join(dirPath, `${name}.pdf`),
        margin: {top: '100px', right: '50px', bottom: '100px', left: '50px'},
        format: 'A4',
    });
    console.log(`Captured ${name} as PDF`)
}

async function savePageToPdf(url: string, browserPage: Page, bookName: string) {
    //Visit the page
    await visitBookUrl(url, browserPage)
    //Emulate the right media type
    await browserPage.emulateMediaType("screen");
    const elementsToRemove = [
        '/html/body/div/header/div',
        '/html/body/div/main/section/div',
        '/html/body/div/main/section/article/section[2]',
        '/html/body/div/main/section/article/button'];

    await Promise.all(elementsToRemove.map(async (xPath) => {
        await removeElements(browserPage, xPath)
    }));
    //Add specific styles
    await addPrintStyles(browserPage)
    //Capture the PDF
    await capturePdf(browserPage, url.split("/").pop().split(".")[0], bookName)
}

//TODO: Fix order of the pages
export async function mergePdfFiles(bookName: string) {
    const dirPath = path.join("..", "captured-books", bookName)
    //Read all .pdf files of that directory
    const files = fs.readdirSync(dirPath).filter(file => file.endsWith(".pdf"));
    //Merge the files
    const merger = new PDFMerger();
    await Promise.all(files.map(async (file) => {
        await merger.add(path.join(dirPath, file), null)
    }));
    //Write the merged file
    const mergedFilePath = path.join(dirPath, `${bookName}-merged.pdf`)
    await merger.save(mergedFilePath);
}

export async function saveBookPages(bookName: string) {
    const {browser, page} = await getAuthenticatedBrowserAndPage(process.env.INSTITUTION_EMAIL);
    const pages = await getBookPages(bookName)
    for (const pageUrl of pages) {
        await savePageToPdf(pageUrl, page, bookName)
    }
    await browser.close()
}


async function getBookPages(bookName: string) {
    const dirPath = path.join("..", "indexed-books")
    const filePath = path.join(dirPath, `${bookName}-pages.json`)
    const fileContent = fs.readFileSync(filePath, "utf-8")
    return JSON.parse(fileContent) as string[]
}


