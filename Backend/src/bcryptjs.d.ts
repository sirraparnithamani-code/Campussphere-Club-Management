declare module 'bcryptjs' {
  const bcrypt: {
    compare(data: string, encrypted: string): Promise<boolean>;
    hash(data: string, salt: number): Promise<string>;
    hashSync(data: string, salt: number): string;
  };
  export default bcrypt;
}
