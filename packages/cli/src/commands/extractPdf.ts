import {format, parseISO} from 'date-fns';
import inquirer from 'inquirer';


type BookInput = {
    firstBookUrl: string;
    bookName: string;
    outputDirectory: string;
    institutionEmail: string;
}

export async function getBookInput() {
    return inquirer.prompt<BookInput>([
        {
            "name": "firstBookUrl",
            "type": "input",
            "message": "Please enter the first book url:"
        },
        {
            "name": "bookName",
            "type": "input",
            "message": "Please enter the book name:"
        }, {
            "name": "outputDirectory",
            "type": "input",
            "message": "Please enter the path to the output directory:"
        },
        {
            "name": "institutionEmail",
            "type": "input",
            "message": "Please enter the email of the institution you would like to access the books from:"
        }]
    )
}

type ShouldReindexInput = {
    shouldReindex: boolean;
}

export async function getIfShouldReindexInput(indexedAt: string) {
    const date = parseISO(indexedAt)
    return inquirer.prompt<ShouldReindexInput>([
        {
            "name": "shouldReindex",
            "type": "confirm",
            "message": `The book has already been indexed at ${format(date, 'dd.MM.yyyy, HH:mm')}. Would you like to reindex it?`
        }
    ])
}

type ShouldBeLandscapeInput = {
    orientation: "Landscape" | "Portrait";
}

export async function getIfShouldBeLandscapeInput() {
    return inquirer.prompt<ShouldBeLandscapeInput>([
        {
            "name": "orientation",
            "type": "list",
            "message": "Should the PDF be landscape or portrait?",
            choices: [
                "Landscape",
                "Portrait"
            ]
        }
    ])
}

type ShouldSkipPagesInput = {
    shouldSkip: boolean;
}
export async function getIfShouldSkipPages() {
    return inquirer.prompt<ShouldSkipPagesInput>([
        {
            name: "shouldSkip",
            type: "confirm",
            message: "Some pages have already been captured. Would you like to skip them?"
        }
    ])
}