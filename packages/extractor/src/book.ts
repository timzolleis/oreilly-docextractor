import {getAuthenticatedBrowserAndPage} from "./prepare-browser.js";
import {Page} from "puppeteer";
import * as fs from "fs";
import * as path from "path";
import * as console from "console";
import ora from "ora";
import PDFMerger from "pdf-merger-js";
export class BookExtractor {
    institutionEmail: string;
    bookName: string;
    firstBookUrl: string;
    outputDirectory: string;


    constructor(institutionEmail: string, bookName: string, firstBookUrl: string, outputDirectory: string) {
        this.institutionEmail = institutionEmail;
        this.bookName = bookName;
        this.firstBookUrl = firstBookUrl;
        this.outputDirectory = outputDirectory;
    }

    getBookPath() {
        return path.join(this.outputDirectory, this.bookName)
    }

    getBookConfiguration() {
        const directoryPath = this.getBookPath();
        const filePath = path.join(directoryPath, `book.json`)
        try {
            const fileContent = fs.readFileSync(filePath, "utf-8")
            return JSON.parse(fileContent) as { name: string, indexedAt: string, pages: string[] }
        } catch (e) {
            return null
        }
    }

    checkIfIndexed() {
        const config = this.getBookConfiguration()
        if (!config || !config.indexedAt) {
            return {
                exists: false,
                indexedAt: null
            }

        }
        return {
            exists: true,
            indexedAt: config.indexedAt
        }
    }


    async indexPages() {
        const {browser, page} = await getAuthenticatedBrowserAndPage(this.institutionEmail);
        const visitedUrls: string[] = [];
        let hasNextElement = true;
        //Visit the URL initially
        await visitBookUrl(this.firstBookUrl, page)
        visitedUrls.push(this.firstBookUrl)
        while (hasNextElement) {
            const nextPageUrl = await getNextPageUrl(page)
            if (!nextPageUrl) {
                hasNextElement = false
                break;
            }
            const spinner = ora("Indexing " + nextPageUrl).start()
            await visitBookUrl(nextPageUrl, page)
            visitedUrls.push(nextPageUrl)
            spinner.succeed("Indexed " + nextPageUrl)
        }
        const fileSpinner = ora("Writing book.json file").start()
        //Write it to the JSON file
        const directoryPath = this.getBookPath();
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, {recursive: true})
        }
        const filePath = path.join(directoryPath, `book.json`)
        const json = {
            name: this.bookName,
            indexedBy: this.institutionEmail,
            indexedAt: new Date().toISOString(),
            pages: visitedUrls
        }
        fs.writeFileSync(filePath, JSON.stringify(json))
        fileSpinner.succeed("Wrote book.json file successfully")
        await browser.close()

    }

    checkIfPagesExist() {
        const config = this.getBookConfiguration()
        if (!config) {
            console.log("no config")
            return {
                found: []
            }
        }
        const directoryPath = this.getBookPath();
        const pageDirectory = path.join(directoryPath, "pages")
        //Read all .pdf files of that directory
        const files = fs.readdirSync(pageDirectory).filter(file => file.endsWith(".pdf"))
        const foundFiles = config.pages.filter(page => {
            const hasFile = files.find(file => {
                const fileName = file.split("_")[1]
                return fileName === `${page.split("/").pop()}.pdf`
            })
            return !!hasFile
        })
        return {
            found: foundFiles
        }
    }

    async extractBookPages(landscape?: boolean) {
        const directoryPath = this.getBookPath();
        //Read the JSON file
        const filePath = path.join(directoryPath, `book.json`)
        if (!fs.existsSync(filePath)) {
            throw new Error(`No book.json file found at ${filePath}, please index the book first`)
        }
        const fileContent = fs.readFileSync(filePath, "utf-8")
        const json = JSON.parse(fileContent) as { name: string, indexedAt: string, pages: string[] }
        const {browser, page} = await getAuthenticatedBrowserAndPage(this.institutionEmail);
        let pageCounter = 0;
        for (const pageUrl of json.pages) {
            const spinner = ora(`Capturing page ${pageUrl}`).start()
            const visitedPage = await getPage(pageUrl, page)
            await capturePdf(visitedPage, directoryPath, `${pageCounter}_${pageUrl.split("/").pop()}`, landscape)
            spinner.succeed(`Captured page ${pageUrl}`)
            pageCounter++;
        }
        await browser.close()
    }

    async mergePages() {
        const spinner = ora("Merging pages").start()
        const directoryPath = this.getBookPath();
        const pdfFiles = path.join(directoryPath, "pages")
        //Read all .pdf files of that directory
        const files = fs.readdirSync(pdfFiles).filter(file => file.endsWith(".pdf"))
        //Sort the files
        files.sort((a, b) => {
            const aIndex = parseInt(a.split("_")[0])
            const bIndex = parseInt(b.split("_")[0])
            return aIndex - bIndex
        });
        //Merge the files
        const merger = new PDFMerger();
        for (const file of files) {
            await merger.add(path.join(pdfFiles, file), null)
            spinner.info("Added " + file)
        }
        //Write the merged file
        const mergedFilePath = path.join(directoryPath, `${this.bookName}.pdf`)
        await merger.save(mergedFilePath);
        spinner.succeed("Merged pages")
    }

}


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

//TODO: Fix landscape mode
async function capturePdf(browserPage: Page, outputDirectory: string, fileName: string, landscape?: boolean) {
    const dirPath = path.join(outputDirectory, "pages")
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, {recursive: true})
    }
    const pdf = await browserPage.pdf({
        path: path.join(dirPath, `${fileName}.pdf`),
        margin: {top: '100px', right: '50px', bottom: '100px', left: '50px'},
        format: 'A4',
        landscape
    });
}

async function getPage(url: string, browserPage: Page) {
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
    return browserPage;
}
