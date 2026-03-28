# e2e test plans

##  GLOBAL env
```
BASE_URL=http://localhost:2486
```

### Authentication
```
file_written_path: src/__test__/e2e/authentication.spec.ts
```
- Test Case 1: User Login
    - File Dependencies:
        - `./../../router/authRouter.ts`
        - `./../../router/viewRouter.ts`
        - `./../../controllers/authController.ts`
    - Steps:
        1. Navigate to the login page.
        2. Enter valid credentials (username and password).
            valid credentials:
            - username: dave@cacdi.com
            - password: test1234
        3. Click the login button.
    - Expected Results:
        - User is redirected to the dashboard.
        - A welcome message is displayed.


- Test Case 2: User Logout
    - File Dependencies:
        - `./../../router/authRouter.ts`
        - `./../../router/viewRouter.ts`
        - `./../../controllers/authController.ts`
    - Steps:
        1. Login as a valid user.
        2. Click the "登出" (Logout) button.
    - Expected Results:
        - User is redirected to the home page.
        - The "登入" (Login) link is visible.

### Basic Navigation
```
file_written_path: src/__test__/e2e/navigation.spec.ts
```
- Test Case 1: Navigate to Home Page
    - File Dependencies:
        - `./../../router/viewRouter.ts`
        - `./../../controllers/viewController.ts`
    - Steps:
        1. Open the base URL in a web browser.
    - Expected Results:
        - The home page loads successfully.
        - The title "首頁 - FurFriend Finder" is displayed.
        - The heading "🐾 FurFriend Finder 🐾" is displayed.
- Test Case 2: Navigate to Shelter Animal Page
    - File Dependencies:
        - `./../../router/viewRouter.ts`
        - `./../../controllers/viewController.ts`
    - Steps:
        1. From the home page, click on the "收容所動物" (Shelter Animals) link.
    - Expected Results:
        - The shelter animal page loads successfully.
        - A list of shelter animals is displayed.
- Test Case 3: Navigate to Report Lost Page
    - File Dependencies:
        - `./../../router/viewRouter.ts`
        - `./../../controllers/viewController.ts`
    - Steps:
        1. From the home page, click on the "協尋登記" (Report Lost) link.
    - Expected Results:
        - The report lost page loads successfully.
        - The title "協尋登記" is displayed.
- Test Case 4: Navigate to Login Page
    - File Dependencies:
        - `./../../router/authRouter.ts`
        - `./../../controllers/authController.ts`
    - Steps:
        1. From the home page, click on the "登入" (Login) link.
    - Expected Results:
        - The login page loads successfully.
- Test Case 5: Navigate to Register Page
    - File Dependencies:
        - `./../../router/authRouter.ts`
        - `./../../controllers/authController.ts`
    - Steps:
        1. From the login page, click on the "註冊" (Register) link.
    - Expected Results:
        - The register page loads successfully.

### Quick Use
```
file_written_path: src/__test__/e2e/quickUse.spec.ts
```
- Test Case 1: Quick Use
    - File Dependencies:
        - `./../../router/viewRouter.ts`
        - `./../../controllers/viewController.ts`
        - `./../../router/animalLostRouter.ts`
        - `./../../controllers/animalLostController.ts`
    - Steps:
        1. Open the base URL in a web browser.
        2. Click on the "快速使用" (Quick Use) button.
        3. Fill in the required fields in the quick use form.
            - Fill in "毛孩名稱" with "二寶"
            - Select "種類" as "狗"
            - Fill in "品種" with "柴犬"
            - Select "性別" as "公"
            - Fill in "毛色" with "黃色"
            - Fill in "走失地點" with "高雄市內門區"
        4. Click the "開始比對" button
        5. Verify that whether the results card is displayed.
    - Expected Results:
        - The quick use page loads successfully.
        - The title "快速使用" is displayed.
        - After submitting the form, the results card is displayed with matching animals.(10 at most)
