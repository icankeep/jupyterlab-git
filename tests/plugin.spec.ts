import 'jest';
import * as git from '../src/git';
import plugin from '../src/index';
import { version } from '../src/version';
import { JupyterLab } from '@jupyterlab/application';
import { showErrorMessage } from '@jupyterlab/apputils';
import { ISettingRegistry, SettingRegistry, URLExt } from '@jupyterlab/coreutils';

jest.mock('../src/git');
jest.mock('@jupyterlab/application');
jest.mock('@jupyterlab/apputils');

describe('plugin', () => {
  const mockGit = git as jest.Mocked<typeof git>;
  const fakeRoot = '/path/to/server';
  let app: jest.Mocked<JupyterLab>;
  let mockResponses: {
    [url: string]: {
      body?: (request: Object) => string;
      status?: number;
    };
  } = {};
  let settingRegistry: jest.Mocked<ISettingRegistry>;

  beforeAll(() => {
    app = new JupyterLab() as jest.Mocked<JupyterLab>;
    settingRegistry = new SettingRegistry({ connector: null }) as jest.Mocked<
      SettingRegistry
    >;
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockGit.httpGitRequest.mockImplementation((url, method, request) => {
      let response: Response;
      if (url in mockResponses) {
        response = new Response(
          mockResponses[url].body
            ? mockResponses[url].body(request)
            : undefined,
          {
            status: mockResponses[url].status
          }
        );
      } else {
        response = new Response(
          `{"message": "No mock implementation for ${url}."}`,
          { status: 404 }
        );
      }
      return Promise.resolve(response);
    });
  });

  describe('#activate', () => {
    it('should fail if no git is installed', async () => {
      // Given
      const endpoint =
        '/git/settings' + URLExt.objectToQueryString({ version });
      mockResponses[endpoint] = {
        body: request =>
          JSON.stringify({
            gitVersion: null,
            frontendVersion: version,
            serverRoot: fakeRoot,
            serverVersion: version
          }),
        status: 200
      };
      const mockedErrorMessage = showErrorMessage as jest.MockedFunction<
        typeof showErrorMessage
      >;

      // When
      const extension = await plugin.activate(
        app,
        null,
        null,
        { defaultBrowser: null },
        null,
        settingRegistry
      );

      // Then
      expect(extension).toBeNull(); // Token is null
      expect(mockedErrorMessage).toHaveBeenCalledWith(
        'Failed to load the jupyterlab-git server extension',
        'git command not found - please ensure you have Git > 2 installed',
        [undefined] // The warning button is undefined as the module @jupyterlab/apputils is mocked
      );
    });

    it('should fail if git version is < 2', async () => {
      // Given
      const endpoint =
        '/git/settings' + URLExt.objectToQueryString({ version });
      mockResponses[endpoint] = {
        body: request =>
          JSON.stringify({
            gitVersion: '1.8.7',
            frontendVersion: version,
            serverRoot: fakeRoot,
            serverVersion: version
          }),
        status: 200
      };
      const mockedErrorMessage = showErrorMessage as jest.MockedFunction<
        typeof showErrorMessage
      >;

      // When
      const extension = await plugin.activate(
        app,
        null,
        null,
        { defaultBrowser: null },
        null,
        settingRegistry
      );

      // Then
      expect(extension).toBeNull(); // Token is null
      expect(mockedErrorMessage).toHaveBeenCalledWith(
        'Failed to load the jupyterlab-git server extension',
        'git command version must be > 2; got 1.8.7.',
        [undefined] // The warning button is undefined as the module @jupyterlab/apputils is mocked
      );
    });
    it('should fail if server and extension version do not match', async () => {
      // Given
      const endpoint =
        '/git/settings' + URLExt.objectToQueryString({ version });
      mockResponses[endpoint] = {
        body: request =>
          JSON.stringify({
            gitVersion: '2.22.0',
            frontendVersion: version,
            serverRoot: fakeRoot,
            serverVersion: '0.1.0'
          }),
        status: 200
      };
      const mockedErrorMessage = showErrorMessage as jest.MockedFunction<
        typeof showErrorMessage
      >;

      // When
      const extension = await plugin.activate(
        app,
        null,
        null,
        { defaultBrowser: null },
        null,
        settingRegistry
      );

      // Then
      expect(extension).toBeNull(); // Token is null
      expect(mockedErrorMessage).toHaveBeenCalledWith(
        'Failed to load the jupyterlab-git server extension',
      'The versions of the JupyterLab Git server frontend and backend do not match. ' +
        `The @jupyterlab/git frontend extension has version: ${
          version
        } ` +
        'while the python package has version 0.1.0. ' +
        'Please install identical version of jupyterlab-git Python package and the @jupyterlab/git extension. Try running: pip install --upgrade jupyterlab-git',
        [undefined] // The warning button is undefined as the module @jupyterlab/apputils is mocked
      );
    });
    it('should fail if the server extension is not installed', async () => {
      // Given
      const endpoint =
        '/git/settings' + URLExt.objectToQueryString({ version });
      mockResponses[endpoint] = {
        status: 404
      };
      const mockedErrorMessage = showErrorMessage as jest.MockedFunction<
        typeof showErrorMessage
      >;

      // When
      const extension = await plugin.activate(
        app,
        null,
        null,
        { defaultBrowser: null },
        null,
        settingRegistry
      );

      // Then
      expect(extension).toBeNull(); // Token is null
      expect(mockedErrorMessage).toHaveBeenCalledWith(
        'Failed to load the jupyterlab-git server extension',
        'Git server extension is unavailable. Please ensure you have installed the ' +
          'JupyterLab Git server extension by running: pip install --upgrade jupyterlab-git. ' +
          'To confirm that the server extension is installed, run: jupyter serverextension list.',
        [undefined] // The warning button is undefined as the module @jupyterlab/apputils is mocked
      );
    });
  });
});
