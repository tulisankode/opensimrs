import { HttpException, HttpStatus } from "../errors/http-exception.js";
import { generateErrorMessage } from "../helpers/generate-message.js"

/**
 *
 * @param {Array<string | number>} elements
 * @returns { Set<{}>}
 */
export function findDuplicateElement(elements) {
    const seen = new Set();
    const duplicates = [];
    elements.forEach((el) => {
      if (seen.has(el)) {
        duplicates.push(el);
      } else {
        seen.add(el);
      }
    });
    return duplicates;
  }
  
  
  /**
   * 
   * @param {Array<string>} data 
   * @param { string } keyName nama dari data yang tidak boleh duplikat
   */
  export function isThereDuplicate(data, keyName){
    const duplicateElement = findDuplicateElement(data);
    if(duplicateElement.length !== 0) {
      throw new HttpException(
        generateErrorMessage("Gagal", "conflic", `${keyName} ${duplicateElement.toString().toUpperCase()} sudah ada, gunakan ${keyName} lain`), HttpStatus.BAD_REQUEST
      )
    }
  }