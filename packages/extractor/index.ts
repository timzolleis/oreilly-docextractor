import {configDotenv} from "dotenv";
import {indexPages, mergePdfFiles, saveBookPages} from "./book";

async function index() {
    configDotenv({
        path: "../.env"
    })
    const bookName = process.env.BOOK_NAME
    await indexPages(bookName, process.env.BOOK_URL)
    await saveBookPages(bookName)
    await mergePdfFiles(bookName)
}

index();