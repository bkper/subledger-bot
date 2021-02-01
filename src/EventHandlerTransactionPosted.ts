import { Account, Book, Transaction } from "bkper";
import { CHILD_CREDIT_ACCOUNT_PROP, CHILD_DEBIT_ACCOUNT_PROP, PARENT_ACCOUNT_PROP } from "./constants";
import { EventHandlerTransaction } from "./EventHandlerTransaction";

export class EventHandlerTransactionPosted extends EventHandlerTransaction {

  protected getTransactionQuery(transaction: bkper.Transaction): string {
    return `remoteId:${transaction.id}`;
  }

  protected async connectedTransactionFound(childBook: Book, parentBook: Book, childTransaction: bkper.Transaction, parentTransaction: Transaction): Promise<string> {
    if (!parentTransaction.isPosted() && this.isReadyToPost(parentTransaction)) {
      await parentTransaction.post();
      return await this.buildFoundResponse(parentBook, parentTransaction);
    }
    return null;
  }

  private async buildFoundResponse(parentBook: Book, parentTransaction: Transaction): Promise<string> {
    let bookAnchor = super.buildBookAnchor(parentBook);
    let amountFormatted = parentBook.formatValue(parentTransaction.getAmount());
    let record = `POSTED: ${parentTransaction.getDateFormatted()} ${amountFormatted} ${await parentTransaction.getCreditAccountName()} ${await parentTransaction.getDebitAccountName()} ${parentTransaction.getDescription()}`;
    return `${bookAnchor}: ${record}`;
  }


  protected async connectedTransactionNotFound(childBook: Book, parentBook: Book, childTransaction: bkper.Transaction): Promise<string> {
    let childCreditAccount = await childBook.getAccount(childTransaction.creditAccount.id);
    let childDebitAccount = await childBook.getAccount(childTransaction.debitAccount.id);
    let parentBookAnchor = super.buildBookAnchor(parentBook);

    let parentCreditAccount = await this.getParentAccount(parentBook, childCreditAccount);
    let parentDebitAccount = await this.getParentAccount(parentBook, childDebitAccount);


    let newTransaction = parentBook.newTransaction()
      .setDate(childTransaction.date)
      .setProperties(childTransaction.properties)
      .setProperty(CHILD_CREDIT_ACCOUNT_PROP, childCreditAccount.getName())
      .setProperty(CHILD_DEBIT_ACCOUNT_PROP, childDebitAccount.getName())
      .setAmount(childTransaction.amount)
      .setCreditAccount(parentCreditAccount)
      .setDebitAccount(parentDebitAccount)
      .setDescription(childTransaction.description)
      .addRemoteId(childTransaction.id);

    let record = `${newTransaction.getDate()} ${newTransaction.getAmount()} ${parentCreditAccount.getName()} ${parentDebitAccount.getName()} ${newTransaction.getDescription()}`;

    if (this.isReadyToPost(newTransaction)) {
      await newTransaction.post();
    } else {
      newTransaction.setDescription(`${newTransaction.getCreditAccount() == null ? parentCreditAccount.getName() : ''} ${newTransaction.getDebitAccount() == null ? parentDebitAccount.getName() : ''} ${newTransaction.getDescription()}`.trim())
      await newTransaction.create();
    }

    return `${parentBookAnchor}: ${record}`;
  }


}