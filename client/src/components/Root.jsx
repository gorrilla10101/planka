import React from 'react';
import PropTypes from 'prop-types';
import { AuthProvider } from 'oidc-react';
import { Provider } from 'react-redux';
import { Route, Routes } from 'react-router-dom';
import { ReduxRouter } from '../lib/redux-router';

import Paths from '../constants/Paths';
import LoginContainer from '../containers/LoginContainer';
import CoreContainer from '../containers/CoreContainer';
import NotFound from './NotFound';

import 'react-datepicker/dist/react-datepicker.css';
import 'photoswipe/dist/photoswipe.css';
import 'easymde/dist/easymde.min.css';
import '../lib/custom-ui/styles.css';
import '../styles.module.scss';
import OidcLoginContainer from '../containers/OidcLoginContainer';

const oidcConfig = {
  authority: 'https://auth.jjakt.monster/realms/test-realm/',
  clientId: 'planka-dev',
  redirectUri: 'http://localhost:3000/OidcLogin',
};

function Root({ store, history }) {
  return (
    <AuthProvider
      onSignIn={oidcConfig.onSignIn}
      authority={oidcConfig.authority}
      clientId={oidcConfig.clientId}
      redirectUri={oidcConfig.redirectUri}
    >
      <Provider store={store}>
        <ReduxRouter history={history}>
          <Routes>
            <Route path={Paths.LOGIN} element={<LoginContainer />} />
            <Route path={Paths.OIDC_LOGIN} element={<OidcLoginContainer />} />
            <Route path={Paths.ROOT} element={<CoreContainer />} />
            <Route path={Paths.PROJECTS} element={<CoreContainer />} />
            <Route path={Paths.BOARDS} element={<CoreContainer />} />
            <Route path={Paths.CARDS} element={<CoreContainer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ReduxRouter>
      </Provider>
    </AuthProvider>
  );
}

Root.propTypes = {
  /* eslint-disable react/forbid-prop-types */
  store: PropTypes.object.isRequired,
  history: PropTypes.object.isRequired,
  /* eslint-enable react/forbid-prop-types */
};

export default Root;
