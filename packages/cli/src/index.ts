import {
    getBookInput,
    getIfShouldBeLandscapeInput,
    getIfShouldReindexInput,
    getIfShouldSkipPages
} from "./commands/extractPdf";
import {BookExtractor} from "@packages/extractor"
import ora from "ora";

async function index() {
    const {bookName, firstBookUrl, outputDirectory, institutionEmail} = await getBookInput();
    const extractor = new BookExtractor(institutionEmail, bookName, firstBookUrl, outputDirectory)
    const {exists, indexedAt} = extractor.checkIfIndexed()
    if (!exists) {
        await extractor.indexPages();
    }
    if (exists) {
        const {shouldReindex} = await getIfShouldReindexInput(indexedAt)
        if (shouldReindex) {
            await extractor.indexPages();
        }
    }
    //Ask if it should be landscape or portrait
    const {orientation} = await getIfShouldBeLandscapeInput()
    //Next, extract the PDF
    const {found} = extractor.checkIfPagesExist()
    if(found.length > 0){
        const {shouldSkip} = await getIfShouldSkipPages()
        if(!shouldSkip){
            await extractor.extractBookPages(orientation === "Landscape")
        }
    } else {
        await extractor.extractBookPages(orientation === "Landscape")
    }
    //Finally, merge the PDF
    await extractor.mergePages();
}

index()