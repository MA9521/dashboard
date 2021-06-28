/*
Copyright 2019-2021 The Tekton Authors
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at
    http://www.apache.org/licenses/LICENSE-2.0
Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { Component } from 'react';
import { SkeletonText } from 'carbon-components-react';
import { FixedSizeList as List } from 'react-window';
import { injectIntl } from 'react-intl';
import utils from './utils';

import Ansi from '../LogFormat';

const LogLine = ({ data, index, style }) => (
  <div style={style}>
    <Ansi>{`${data[index]}\n`}</Ansi>
  </div>
);

const itemSize = 15; // This should be kept in sync with the line-height in SCSS
const defaultHeight = itemSize * 100 + itemSize / 2;

export class LogContainer extends Component {
  constructor(props) {
    super(props);
    this.state = { loading: true };
    this.logRef = React.createRef();
    this.textRef = React.createRef();
  }

  componentDidMount() {
    this.loadLog();
    window.addEventListener("scroll", this.handleLogScroll, true);
    if (this.shouldAutoScroll(this.props.stepStatus)) {
      this.scrollToBottomLog();
      return; // the scroll event listener will call handleLogScroll
    }
    this.handleLogScroll();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      prevState.logs?.length !== this.state.logs?.length ||
      prevProps.isLogsMaximized !== this.props.isLogsMaximized
    ) {
      if (this.shouldAutoScroll(this.props.stepStatus, prevProps.stepStatus)) {
        this.scrollToBottomLog();
        return; // the scroll event listener will call handleLogScroll
      }
      this.handleLogScroll();
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    window.removeEventListener("scroll", this.handleLogScroll, true);
    this.cancelled = true;
  }

  handleLogScroll = () => {
    const isLogBottomUnseen = this.isLogBottomUnseen();

    if (
      isLogBottomUnseen !== this.state.isLogBottomUnseen
    ) {
      this.setState({
        isLogBottomUnseen
      });
    }
  };
  
  isLogBottomUnseen = () => {
    return utils.isElementEndBelowViewBottom(this.logRef?.current)
      || utils.hasElementPositiveScrollBottom(this.textRef?.current?.firstElementChild);
  };

  scrollToBottomLog = () => {
    const longTextElement = this.textRef?.current?.firstElementChild;
    if (utils.hasElementPositiveScrollBottom(longTextElement)) {
      longTextElement.scrollTop = longTextElement.scrollHeight - longTextElement.clientHeight;
    }
    const rootElement = document.documentElement;
    rootElement.scrollTop = rootElement.scrollHeight - rootElement.clientHeight;
  };

  shouldAutoScroll = (stepStatus, prevStepStatus) => {
    return this.props.enableLogAutoScroll && !this.state.isLogBottomUnseen &&
      (
        (stepStatus && !stepStatus.terminated) ||
        (stepStatus?.terminated && prevStepStatus && !prevStepStatus.terminated)
      ) &&
      this.isLogBottomUnseen();
  };

  getLogList = () => {
    const { stepStatus, intl } = this.props;
    const { reason } = (stepStatus && stepStatus.terminated) || {};
    const {
      logs = [
        intl.formatMessage({
          id: 'dashboard.pipelineRun.logEmpty',
          defaultMessage: 'No log available'
        })
      ]
    } = this.state;

    if (logs.length < 20000) {
      return <Ansi>{logs.join('\n')}</Ansi>;
    }

    const height = reason
      ? Math.min(defaultHeight, itemSize * logs.length)
      : defaultHeight;

    return (
      <List
        height={height}
        itemCount={logs.length}
        itemData={logs}
        itemSize={itemSize}
        width="100%"
      >
        {LogLine}
      </List>
    );
  };

  getTrailerMessage = trailer => {
    const { intl } = this.props;

    switch (trailer) {
      case 'Completed':
        return intl.formatMessage({
          id: 'dashboard.pipelineRun.stepCompleted',
          defaultMessage: 'Step completed'
        });
      case 'Error':
        return intl.formatMessage({
          id: 'dashboard.pipelineRun.stepFailed',
          defaultMessage: 'Step failed'
        });
      default:
        return null;
    }
  };

  readChunks = ({ done, value }, decoder, text = '') => {
    if (this.cancelled) {
      this.reader.cancel();
      return undefined;
    }
    let logs = text;
    if (value) {
      logs += decoder.decode(value, { stream: !done });
      this.setState({
        loading: false,
        logs: logs.split('\n')
      });
    } else {
      this.setState({
        loading: false
      });
    }
    if (done) {
      return undefined;
    }
    return this.reader
      .read()
      .then(result => this.readChunks(result, decoder, logs))
      .catch(error => {
        console.error(error); // eslint-disable-line no-console
        return this.loadLog();
      });
  };

  loadLog = async () => {
    const {
      fetchLogs,
      forcePolling,
      intl,
      stepStatus,
      pollingInterval
    } = this.props;
    if (!fetchLogs) {
      return;
    }

    let continuePolling = false;
    try {
      continuePolling = forcePolling || (stepStatus && !stepStatus.terminated);
      const logs = await fetchLogs();
      if (logs?.getReader) {
        // logs is a https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream
        const decoder = new TextDecoder();
        this.reader = logs.getReader();
        await this.reader
          .read()
          .then(result => this.readChunks(result, decoder))
          .catch(error => {
            throw error;
          });
      } else {
        this.setState({
          loading: false,
          logs: logs ? logs.split('\n') : undefined
        });
        if (continuePolling) {
          this.timer = setTimeout(this.loadLog, pollingInterval);
        }
      }
    } catch (error) {
      console.error(error); // eslint-disable-line no-console
      this.setState({
        loading: false,
        logs: [
          intl.formatMessage({
            id: 'dashboard.pipelineRun.logFailed',
            defaultMessage: 'Unable to fetch log'
          })
        ]
      });
      if (continuePolling) {
        this.timer = setTimeout(this.loadLog, pollingInterval);
      }
    }
  };

  logTrailer = () => {
    const { stepStatus } = this.props;
    const { reason } = (stepStatus && stepStatus.terminated) || {};
    const trailer = this.getTrailerMessage(reason);
    if (!trailer) {
      return null;
    }

    return (
      <div className="tkn--log-trailer" data-status={reason}>
        {trailer}
      </div>
    );
  };

  render() {
    const { toolbar } = this.props;
    const { loading } = this.state;
    return (
      <pre className="tkn--log" ref={this.logRef}>
        {loading ? (
          <SkeletonText paragraph width="60%" />
        ) : (
          <>
            {toolbar}
            <div className="tkn--log-container" ref={this.textRef}>{this.getLogList()}</div>
            {this.logTrailer()}
          </>
        )}
      </pre>
    );
  }
}

LogContainer.defaultProps = {
  pollingInterval: 4000
};

export default injectIntl(LogContainer);
